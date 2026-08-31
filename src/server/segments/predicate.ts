import { sql, type SQL } from "drizzle-orm";
import type { SegmentFilter } from "./schema";

/**
 * Turning a segment into SQL.
 *
 * One function, returning a list of predicates that are ANDed together against a
 * fixed FROM clause (see `SEGMENT_FROM`). It is written as raw `sql` fragments rather
 * than Drizzle's query builder because two of the conditions — the consent gate and
 * the merged-identity union — are correlated subqueries that the builder cannot
 * express, and splitting the rest across two idioms would make the whole thing harder
 * to read than either alone.
 *
 * ## Three rules the whole file follows
 *
 * 1. **LEFT JOIN, not INNER.** The matcher joins `contact_preferences` with an INNER
 *    JOIN (engine.ts:145), which makes a contact with no preferences row invisible to
 *    it entirely. Here they must remain reachable by role, intent or "everyone", so
 *    every preference-derived criterion is written to tolerate a missing row.
 *
 * 2. **A missing value is unknown, not yes.** `budget_at_least = 800000` excludes a
 *    contact with `price_max IS NULL` unless `includeUnknowns` is set. The matcher
 *    does the opposite, correctly, for its own question — see the header of
 *    ./schema.ts for why the two differ.
 *
 * 3. **Unsendable is never in the segment.** Do-not-contact, tombstoned, merged-away,
 *    no mobile and lapsed SMS consent are applied unconditionally and cannot be
 *    switched off from the UI. The preview counts them separately so the agent sees
 *    WHY the number is smaller than they expected, but no filter can put them back.
 */

/**
 * The FROM clause every segment query shares.
 *
 * `contact_preferences` is 1:1 (its `contact_id` is unique), so the join cannot fan
 * out and the row count is the contact count. `contact_intent` is keyed by
 * `contact_id` as its primary key, likewise 1:1.
 */
export const SEGMENT_FROM = sql`
  from contacts c
  left join contact_preferences cp on cp.contact_id = c.id
  left join contact_intent ci on ci.contact_id = c.id
`;

/**
 * Contactability, as separable reasons.
 *
 * Exported individually rather than as one blob because the preview reports the
 * exclusions by cause — "38 match, 6 excluded: 4 no consent, 2 no mobile" is the line
 * that stops a bad send, and it cannot be produced from a single AND.
 */
export const contactability = {
  /** A tombstoned record asked to be forgotten; a merged one is not where activity goes. */
  live: sql`c.tombstoned_at is null and c.merged_into_id is null`,
  notDnc: sql`c.do_not_contact = false`,
  hasMobile: sql`c.phone_e164 is not null and length(trim(c.phone_e164)) > 0`,

  /**
   * SMS consent, replicating `checkConsent` (gate.ts:106-138) as a set operation.
   *
   * The rule there is **latest-wins within a record, strictest-wins across the merged
   * identity**, and both halves are load-bearing: pure latest-wins over the union let
   * a survivor's grant override a duplicate's later unsubscribe, and pure
   * strictest-wins meant anyone who ever opted out could never opt back in.
   *
   * So: `distinct on (contact_id)` ordered by `(occurred_at desc, created_at desc)`
   * gives the current row per record — the `created_at` tie-break matters because two
   * rows can share a caller-supplied `occurred_at` — and the segment excludes the
   * contact if ANY record in the identity currently reads other than 'granted'.
   *
   * The second clause is the one that is easy to miss: a contact with NO consent rows
   * at all is `never_given` and must be excluded, and "no non-granted current row" is
   * trivially true for them.
   *
   * This is an ESTIMATE and is labelled as one everywhere it surfaces. Rule 2 puts the
   * authoritative check at the instant of sending, per recipient, through the gate
   * itself — a preview cannot know what someone will do between now and then.
   */
  smsConsent: sql`
    exists (
      select 1 from consents k
      where k.channel = 'sms'
        and (k.contact_id = c.id
             or k.contact_id in (select m.id from contacts m where m.merged_into_id = c.id))
    )
    and not exists (
      select 1 from (
        select distinct on (k2.contact_id) k2.contact_id, k2.status
        from consents k2
        where k2.channel = 'sms'
          and (k2.contact_id = c.id
               or k2.contact_id in (select m2.id from contacts m2 where m2.merged_into_id = c.id))
        order by k2.contact_id, k2.occurred_at desc, k2.created_at desc
      ) current_state
      where current_state.status <> 'granted'
    )
  `,
};

/** Everything that must be true before a contact can be messaged at all. */
export function contactablePredicates(): SQL[] {
  return [
    contactability.live,
    contactability.notDnc,
    contactability.hasMobile,
    contactability.smsConsent,
  ];
}

/**
 * A numeric criterion that tolerates — or refuses — a missing value.
 *
 * `column op value`, plus `or column is null` only when the agent has asked for
 * unknowns. This one helper is where rule 2 above actually lives, so the behaviour is
 * decided once rather than re-argued at each of the six numeric filters.
 */
function numeric(column: SQL, op: SQL, value: number, includeUnknowns: boolean): SQL {
  const known = sql`${column} ${op} ${value}`;
  return includeUnknowns ? sql`(${known} or ${column} is null)` : known;
}

/**
 * The criteria the agent actually chose.
 *
 * Returns an empty array for an empty segment, which correctly means "everyone
 * contactable" once combined with `contactablePredicates()`.
 */
export function criteriaPredicates(f: SegmentFilter): SQL[] {
  const p: SQL[] = [];
  const unk = f.includeUnknowns;

  /**
   * Where they want to buy — a real FK on `contact_preference_suburbs`.
   *
   * Note this is an EXISTS against the preference row, so a contact with no
   * preferences never satisfies it. That is correct: "wants Norwood" is a claim, and
   * we have no evidence for it. `includeUnknowns` deliberately does NOT relax this —
   * a suburb list is the most specific thing an agent can ask for, and silently
   * widening it to "and everyone we know nothing about" would be a surprise.
   */
  if (f.wantsSuburbIds) {
    p.push(sql`
      exists (
        select 1 from contact_preference_suburbs s
        where s.preference_id = cp.id
          and s.suburb_id in ${sql.raw(`(${f.wantsSuburbIds.map((id) => `'${escapeUuid(id)}'`).join(",")})`)}
      )
    `);
  }

  /** Where they live now. Free text on `contacts.suburb`, a different question. */
  if (f.livesInSuburb) {
    p.push(sql`lower(trim(c.suburb)) = lower(trim(${f.livesInSuburb}))`);
  }

  // "Their budget reaches at least X" reads price_max: the top of what they will pay.
  if (f.budgetAtLeast !== undefined) {
    p.push(numeric(sql`cp.price_max`, sql.raw(">="), f.budgetAtLeast, unk));
  }
  // "Their budget starts no higher than X" reads price_min.
  if (f.budgetAtMost !== undefined) {
    p.push(numeric(sql`cp.price_min`, sql.raw("<="), f.budgetAtMost, unk));
  }
  if (f.rentAtLeastPw !== undefined) {
    p.push(numeric(sql`cp.rent_pw_max`, sql.raw(">="), f.rentAtLeastPw, unk));
  }
  if (f.bedsAtLeast !== undefined) {
    p.push(numeric(sql`cp.beds_min`, sql.raw(">="), f.bedsAtLeast, unk));
  }
  if (f.bathsAtLeast !== undefined) {
    p.push(numeric(sql`cp.baths_min`, sql.raw(">="), f.bathsAtLeast, unk));
  }
  if (f.parkingAtLeast !== undefined) {
    p.push(numeric(sql`cp.parking_min`, sql.raw(">="), f.parkingAtLeast, unk));
  }

  /**
   * Property types. An EMPTY array on the contact means "no preference stated" and is
   * treated exactly like null — the same equivalence the matcher makes at
   * engine.ts:166, and for the same reason: `cardinality = 0` is not a claim about
   * anything.
   */
  if (f.propertyTypes) {
    const list = sql.raw(
      `array[${f.propertyTypes.map((t) => `'${t}'`).join(",")}]::property_type[]`,
    );
    const stated = sql`(cp.property_types is not null and cardinality(cp.property_types) > 0 and cp.property_types && ${list})`;
    p.push(
      unk
        ? sql`(${stated} or cp.property_types is null or cardinality(cp.property_types) = 0)`
        : stated,
    );
  }

  /**
   * Roles. Multi-row, so an EXISTS — and by default only roles that have not lapsed.
   * `active_to` has never been consulted anywhere in the codebase; pitching a vendor
   * whose listing sold two years ago is the reason to start.
   */
  if (f.roles) {
    const list = sql.raw(
      `array[${f.roles.map((r) => `'${r}'`).join(",")}]::contact_role[]`,
    );
    const lapsed = f.includeLapsedRoles
      ? sql``
      : sql` and (r.active_to is null or r.active_to >= current_date)`;
    p.push(sql`
      exists (
        select 1 from contact_roles r
        where r.contact_id = c.id and r.role = any(${list})${lapsed}
      )
    `);
  }

  /**
   * Intent and sentiment are DERIVED (contact_intent is rebuilt from the interaction
   * log after every touch). Segmenting on them is segmenting on something that can
   * change underneath you between preview and send — which is fine, and worth knowing.
   */
  if (f.intentTypes) {
    const list = sql.raw(
      `array[${f.intentTypes.map((t) => `'${t}'`).join(",")}]::intent_type[]`,
    );
    const stated = sql`ci.intent_type = any(${list})`;
    p.push(unk ? sql`(${stated} or ci.intent_type is null)` : stated);
  }
  if (f.sentiments) {
    const list = sql.raw(
      `array[${f.sentiments.map((t) => `'${t}'`).join(",")}]::sentiment[]`,
    );
    const stated = sql`ci.sentiment = any(${list})`;
    p.push(unk ? sql`(${stated} or ci.sentiment is null)` : stated);
  }

  /**
   * Free text, matched exactly.
   *
   * `timeline` exists on BOTH `contact_preferences` and `contact_intent` with no
   * stated precedence, so this matches either — a value the agent picked from the
   * observed list should find the contact it came from, whichever column held it.
   * Exact, never LIKE: "not started" as a substring also matches "started".
   */
  if (f.timelineAny) {
    const list = textArray(f.timelineAny);
    const stated = sql`(cp.timeline = any(${list}) or ci.timeline = any(${list}))`;
    p.push(
      unk ? sql`(${stated} or (cp.timeline is null and ci.timeline is null))` : stated,
    );
  }
  if (f.financeStatusAny) {
    const list = textArray(f.financeStatusAny);
    const stated = sql`cp.finance_status = any(${list})`;
    p.push(unk ? sql`(${stated} or cp.finance_status is null)` : stated);
  }

  /**
   * Recency. Counts every interaction on the record, inbound or outbound — someone who
   * emailed us yesterday has been in touch, and an SMS blast on top of that reads as
   * not listening. Tombstoned interactions are excluded because they are erased.
   */
  if (f.notContactedWithinDays !== undefined) {
    p.push(sql`
      not exists (
        select 1 from interactions i
        where i.contact_id = c.id
          and i.tombstoned_at is null
          and i.occurred_at >= now() - ${`${f.notContactedWithinDays} days`}::interval
      )
    `);
  }

  /** Suppression against earlier campaigns — only where something was actually sent. */
  if (f.excludeCampaignIds) {
    p.push(sql`
      not exists (
        select 1 from campaign_recipients cr
        where cr.contact_id = c.id
          and cr.sent_at is not null
          and cr.campaign_id in ${sql.raw(`(${f.excludeCampaignIds.map((id) => `'${escapeUuid(id)}'`).join(",")})`)}
      )
    `);
  }

  return p;
}

/** Combine predicates with AND. An empty list is `true` — everyone. */
export function andAll(predicates: SQL[]): SQL {
  if (predicates.length === 0) return sql`true`;
  return predicates.reduce((acc, p) => sql`${acc} and (${p})`, sql`true`);
}

/**
 * A `text[]` literal.
 *
 * Drizzle renders a JS array inside `= any(...)` as a TUPLE, which Postgres rejects
 * with 42809 — the same trap the matcher hit at engine.ts:403. Building the array
 * literal explicitly avoids it. Values are escaped rather than parameterised because
 * they are interpolated into `sql.raw`; they arrive from a Zod-validated list capped
 * at 40 items of 120 characters.
 */
function textArray(values: string[]): SQL {
  const escaped = values.map((v) => `'${v.replace(/'/g, "''")}'`).join(",");
  return sql.raw(`array[${escaped}]::text[]`);
}

/**
 * UUIDs reach `sql.raw` for the same reason, so they are re-validated here rather
 * than trusted. Zod has already checked them; this is the belt to that braces, and it
 * throws rather than sanitising — a value that is not a UUID at this point means the
 * schema was bypassed, and quietly stripping it would hide that.
 */
function escapeUuid(id: string): string {
  if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
    throw new Error(`Not a uuid: ${id.slice(0, 40)}`);
  }
  return id;
}

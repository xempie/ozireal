import { describe, it, expect, beforeAll, afterAll } from "vitest";
import postgres from "postgres";
import { systemTenantId, withTenant } from "@/db";
import { segmentFilter, parseStoredFilter, describeSegment } from "@/server/segments/schema";
import { previewSegmentIn, segmentAudience } from "@/server/segments/preview";
import { checkConsent } from "@/server/outbound/gate";

/**
 * The segment builder.
 *
 * Two of these tests exist for specific reasons rather than for coverage:
 *
 * 1. **The SQL must actually execute.** The matcher's stage-1 filter failed with
 *    42P08 on every invocation for months, invisibly, because no test ever reached
 *    it. Every predicate here is exercised at least once against a real database.
 *
 * 2. **The consent predicate must agree with `checkConsent`.** The preview
 *    reimplements the gate's latest-per-record / strictest-across-identity rule as
 *    set-based SQL. Two implementations of one rule is exactly where a silent
 *    divergence lives, and the consequence of divergence is messaging someone who
 *    opted out — so the last block asserts they agree contact by contact.
 */

let sql: postgres.Sql;
let tenantId: string;

beforeAll(async () => {
  sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  tenantId = await systemTenantId();
});

/**
 * No fixture cleanup, deliberately.
 *
 * tests/global-setup.ts drops and recreates the database for every run, so there is
 * nothing to clean up — and the first draft of this file tried anyway and could not:
 * deleting a contact cascades to `consents`, which an append-only trigger refuses.
 * That refusal is the system working.
 */
afterAll(async () => {
  await sql?.end();
});

const f = (over: Record<string, unknown> = {}) => segmentFilter.parse(over);
const preview = (over: Record<string, unknown> = {}) =>
  withTenant(tenantId, (tx) => previewSegmentIn(tx, f(over)));

/** A contact built to be reachable, with whatever attributes the caller wants. */
async function makeContact(opts: {
  phone?: string | null;
  consent?: "granted" | "revoked" | null;
  dnc?: boolean;
  priceMax?: number | null;
  priceMin?: number | null;
  bedsMin?: number | null;
  financeStatus?: string | null;
  propertyTypes?: string[] | null;
  withPreferences?: boolean;
  role?: string;
  roleActiveTo?: string | null;
}) {
  const stamp = Date.now().toString().slice(-6) + Math.floor(Math.random() * 1000);
  const [c] = await sql<{ id: string }[]>`
    insert into contacts (tenant_id, first_name, last_name, source_channel, phone_e164, do_not_contact)
    values (${tenantId}, 'Seg', ${`Case${stamp}`}, 'manual',
            ${opts.phone === undefined ? `+6141${stamp.padStart(7, "0").slice(0, 7)}` : opts.phone},
            ${opts.dnc ?? false})
    returning id`;

  if (opts.withPreferences !== false) {
    await sql`
      insert into contact_preferences
        (tenant_id, contact_id, price_min, price_max, beds_min, finance_status, property_types)
      values (${tenantId}, ${c.id}, ${opts.priceMin ?? null}, ${opts.priceMax ?? null},
              ${opts.bedsMin ?? null}, ${opts.financeStatus ?? null},
              ${opts.propertyTypes ? sql`${opts.propertyTypes}::property_type[]` : null})`;
  }
  if (opts.role) {
    await sql`
      insert into contact_roles (tenant_id, contact_id, role, active_to)
      values (${tenantId}, ${c.id}, ${opts.role}::contact_role, ${opts.roleActiveTo ?? null})`;
  }
  if (opts.consent !== null) {
    await sql`
      insert into consents (tenant_id, contact_id, channel, status, source_form, wording_shown, occurred_at)
      values (${tenantId}, ${c.id}, 'sms', ${opts.consent ?? "granted"}, 'test fixture',
              'I agree to receive SMS', now())`;
  }
  return c.id;
}

const ids = (p: { sample: { id: string }[] }) => p.sample.map((s) => s.id);

/* ------------------------------------------------------------------ schema */

describe("the filter schema", () => {
  it("treats an empty multi-select as no constraint, not 'none of them'", () => {
    const parsed = f({ roles: [], propertyTypes: [], wantsSuburbIds: [] });
    expect(parsed.roles).toBeUndefined();
    expect(parsed.propertyTypes).toBeUndefined();
    expect(parsed.wantsSuburbIds).toBeUndefined();
  });

  it("keeps a blank number as absent rather than zero", () => {
    // "" through z.coerce.number() is 0, which would read as a real budget of nothing.
    const parsed = f({ budgetAtLeast: "", bedsAtLeast: "" });
    expect(parsed.budgetAtLeast).toBeUndefined();
    expect(parsed.bedsAtLeast).toBeUndefined();
  });

  it("degrades a stored filter it cannot read to the empty segment", () => {
    // The seed wrote {"note": "..."} into saved_views.filter, which is not a filter.
    const parsed = parseStoredFilter({ note: "Buyers who went quiet" });
    expect(parsed.includeUnknowns).toBe(false);
    expect(describeSegment(parsed)).toMatch(/everyone who can be contacted/i);
  });

  it("describes itself in words a person can check", () => {
    const text = describeSegment(
      f({ roles: ["buyer"], budgetAtLeast: 650000, budgetAtMost: 800000, bedsAtLeast: 3 }),
    );
    expect(text).toContain("buyer");
    expect(text).toContain("$650k");
    expect(text).toContain("3+ bed");
  });
});

/* ---------------------------------------------------------------- the SQL */

describe("every predicate executes against a real database", () => {
  it("runs the empty segment", async () => {
    const p = await preview();
    expect(p.eligible).toBeGreaterThanOrEqual(0);
    expect(p.matchedCriteria).toBeGreaterThanOrEqual(p.eligible);
  });

  it("runs every criterion at once without erroring", async () => {
    const [sub] = await sql<{ id: string }[]>`select id from suburbs limit 1`;
    const [camp] = await sql<{ id: string }[]>`select id from campaigns limit 1`;
    const p = await preview({
      wantsSuburbIds: [sub.id],
      livesInSuburb: "Norwood",
      budgetAtLeast: 500000,
      budgetAtMost: 900000,
      rentAtLeastPw: 400,
      bedsAtLeast: 2,
      bathsAtLeast: 1,
      parkingAtLeast: 1,
      propertyTypes: ["house", "unit"],
      roles: ["buyer", "investor"],
      intentTypes: ["buying"],
      sentiments: ["hot", "warm"],
      timelineAny: ["Within 3 months"],
      financeStatusAny: ["Pre-approved"],
      notContactedWithinDays: 14,
      excludeCampaignIds: camp ? [camp.id] : [],
    });
    expect(p.eligible).toBeGreaterThanOrEqual(0);
  });

  it("refuses a uuid that did not come through the schema", async () => {
    // criteriaPredicates interpolates ids into sql.raw, so it re-validates rather
    // than trusting the caller. A bypass must throw, not sanitise silently.
    await expect(
      withTenant(tenantId, (tx) =>
        previewSegmentIn(tx, {
          ...f(),
          wantsSuburbIds: ["'; drop table contacts; --"] as unknown as string[],
        }),
      ),
    ).rejects.toThrow(/not a uuid/i);
  });
});

/* -------------------------------------------------- unknown is not yes */

describe("a missing value is unknown, not yes", () => {
  it("excludes an unstated budget from a budget criterion, and includeUnknowns restores it", async () => {
    const stated = await makeContact({ priceMax: 900_000 });
    const unstated = await makeContact({ priceMax: null });

    const strict = await preview({ budgetAtLeast: 800_000 });
    expect(ids(strict)).toContain(stated);
    // The matcher would include this one — correctly, for its own question. A
    // segment asking "whose budget reaches 800k" must not.
    expect(ids(strict)).not.toContain(unstated);

    const loose = await preview({ budgetAtLeast: 800_000, includeUnknowns: true });
    expect(ids(loose)).toContain(stated);
    expect(ids(loose)).toContain(unstated);
  });

  it("treats an empty property_types array exactly like null", async () => {
    const empty = await makeContact({ propertyTypes: [] });
    const strict = await preview({ propertyTypes: ["house"] });
    expect(ids(strict)).not.toContain(empty);
    const loose = await preview({ propertyTypes: ["house"], includeUnknowns: true });
    expect(ids(loose)).toContain(empty);
  });

  it("never matches a preference criterion for a contact with no preferences row", async () => {
    const bare = await makeContact({ withPreferences: false });
    const p = await preview({ bedsAtLeast: 2 });
    expect(ids(p)).not.toContain(bare);
    // ...but they are reachable when no preference criterion is set. The matcher
    // INNER JOINs preferences and cannot see this person at all.
    const everyone = await preview();
    expect(ids(everyone)).toContain(bare);
  });

  it("does not widen a suburb list when includeUnknowns is on", async () => {
    const [sub] = await sql<{ id: string }[]>`select id from suburbs limit 1`;
    const noSuburbs = await makeContact({});
    const p = await preview({ wantsSuburbIds: [sub.id], includeUnknowns: true });
    expect(ids(p)).not.toContain(noSuburbs);
  });
});

/* ------------------------------------------------------- contactability */

describe("an unsendable contact is never in the audience", () => {
  it("excludes no consent, revoked consent, no mobile and do-not-contact", async () => {
    const ok = await makeContact({});
    const noConsent = await makeContact({ consent: null });
    const revoked = await makeContact({ consent: "revoked" });
    const noMobile = await makeContact({ phone: null });
    const dnc = await makeContact({ dnc: true });

    const p = await preview();
    expect(ids(p)).toContain(ok);
    for (const bad of [noConsent, revoked, noMobile, dnc]) {
      expect(ids(p)).not.toContain(bad);
    }
  });

  it("reports the exclusions by cause rather than as one number", async () => {
    const before = await preview();
    await makeContact({ consent: null });
    await makeContact({ phone: null });
    await makeContact({ dnc: true });
    const after = await preview();

    expect(after.excluded.noConsent).toBeGreaterThan(before.excluded.noConsent);
    expect(after.excluded.noMobile).toBeGreaterThan(before.excluded.noMobile);
    expect(after.excluded.doNotContact).toBeGreaterThan(before.excluded.doNotContact);
    // The causes overlap (no mobile AND no consent is one person, two reasons), so
    // the breakdown is not a partition and must not be presented as summing.
    expect(after.excludedTotal).toBe(after.matchedCriteria - after.eligible);
  });

  it("cannot be switched back on by any filter", async () => {
    const revoked = await makeContact({ consent: "revoked" });
    const p = await preview({ includeUnknowns: true });
    expect(ids(p)).not.toContain(revoked);
  });
});

/* --------------------------------------------------------------- roles */

describe("roles", () => {
  it("ignores a lapsed role by default and includes it on request", async () => {
    const lapsed = await makeContact({ role: "vendor", roleActiveTo: "2020-01-01" });
    const current = await makeContact({ role: "vendor" });

    const now = await preview({ roles: ["vendor"] });
    expect(ids(now)).toContain(current);
    // active_to has never been consulted anywhere in the codebase until now.
    expect(ids(now)).not.toContain(lapsed);

    const ever = await preview({ roles: ["vendor"], includeLapsedRoles: true });
    expect(ids(ever)).toContain(lapsed);
  });
});

/* ------------------------------------------- agreement with the send gate */

describe("the consent predicate agrees with checkConsent", () => {
  it("matches the gate contact by contact, including a merged identity", async () => {
    /**
     * The case that makes this worth testing: a duplicate record whose LATER
     * revocation must block the survivor. Latest-wins over the union would miss it;
     * strictest-wins alone would bar anyone who ever unsubscribed. The gate does
     * latest-per-record then strictest-across, and so must the SQL.
     */
    const survivor = await makeContact({});
    const duplicate = await makeContact({ consent: null });
    await sql`
      insert into consents (tenant_id, contact_id, channel, status, source_form, wording_shown, occurred_at)
      values (${tenantId}, ${duplicate}, 'sms', 'revoked', 'test fixture',
              'STOP', now() + interval '1 minute')`;
    /**
     * A merged record must ALSO be tombstoned — `contacts_merge_is_consistent`
     * refuses the pointer on its own, which is right: a superseded record that still
     * accepts activity is the split history the merge exists to end. Setting only
     * the pointer, as the first draft of this test did, is not a merge.
     */
    await sql`update contacts
                 set merged_into_id = ${survivor}, tombstoned_at = now()
               where id = ${duplicate}`;

    const p = await preview();
    expect(ids(p), "a duplicate's later unsubscribe blocks the survivor").not.toContain(
      survivor,
    );

    // And every contact the preview DID return must pass the real gate.
    const everyone = await preview();
    const verdicts = await withTenant(tenantId, async (tx) => {
      const out: { id: string; allowed: boolean }[] = [];
      for (const c of everyone.sample.slice(0, 40)) {
        const d = await checkConsent(tx, c.id, "sms");
        out.push({ id: c.id, allowed: d.allowed });
      }
      return out;
    });
    const disagreements = verdicts.filter((v) => !v.allowed);
    expect(
      disagreements,
      `the gate refused ${disagreements.length} contacts the preview offered`,
    ).toEqual([]);
  });
});

/* ------------------------------------------------------------- audience */

describe("the audience", () => {
  it("returns the same people as the preview, with the material a draft needs", async () => {
    await makeContact({ priceMax: 850_000, financeStatus: "Pre-approved" });
    const p = await preview({ budgetAtLeast: 800_000 });
    const audience = await withTenant(tenantId, (tx) =>
      segmentAudience(tx, f({ budgetAtLeast: 800_000 })),
    );
    expect(audience.length).toBe(p.eligible);
    const one = audience[0];
    expect(one.firstName).toBeTruthy();
    expect(one.phone).toBeTruthy();
    // Personalisation reads these; a null is fine, a missing key is not.
    expect(one).toHaveProperty("rollingBrief");
    expect(one).toHaveProperty("softRequirements");
    expect(one).toHaveProperty("lastFollowupOutcome");
  });
});

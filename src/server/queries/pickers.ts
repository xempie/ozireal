import { asc, eq, isNull, and, sql } from "drizzle-orm";
import { query } from "@/db";
import { suburbs, properties, listings, contacts, savedViews } from "@/db/schema";
import {
  CONTACT_ROLES,
  INTENT_TYPES,
  PROPERTY_TYPES,
  SENTIMENTS,
  isEmptySegment,
  parseStoredFilter,
} from "@/server/segments/schema";

/**
 * Reference lists for the create forms.
 *
 * Deliberately narrow projections. A picker needs an id and a label; handing a
 * client component the whole row is how internal_notes and
 * internal_price_expectation end up in a page payload (rule 8).
 */

export async function suburbOptions() {
  return query((tx) =>
    tx
      .select({ value: suburbs.id, label: suburbs.name })
      .from(suburbs)
      .orderBy(asc(suburbs.name)),
  );
}

/** Properties, addressed for a human. Excludes archived stock. */
export async function propertyOptions() {
  return query((tx) =>
    tx
      .select({
        value: properties.id,
        label: sql<string>`
          trim(both ' ' from
            coalesce(${properties.unit} || '/', '') ||
            coalesce(${properties.streetNumber} || ' ', '') ||
            coalesce(${properties.street}, '')
          ) || coalesce(', ' || ${suburbs.name}, '')`,
      })
      .from(properties)
      .leftJoin(suburbs, eq(suburbs.id, properties.suburbId))
      .where(sql`${properties.status} <> 'archived'`)
      .orderBy(asc(properties.street)),
  );
}

/** Live and draft campaigns, for linking a task or an event to one. */
export async function listingOptions() {
  return query((tx) =>
    tx
      .select({
        value: listings.id,
        label: sql<string>`
          trim(both ' ' from
            coalesce(${properties.streetNumber} || ' ', '') || coalesce(${properties.street}, '')
          ) || coalesce(', ' || ${suburbs.name}, '')`,
      })
      .from(listings)
      .innerJoin(properties, eq(properties.id, listings.propertyId))
      .leftJoin(suburbs, eq(suburbs.id, properties.suburbId))
      .where(sql`${listings.status} in ('draft','live','under_offer')`)
      .orderBy(asc(properties.street)),
  );
}

/** Contactable people only — tombstoned and merged-away records are not options. */
export async function contactOptions() {
  return query((tx) =>
    tx
      .select({
        value: contacts.id,
        label: sql<string>`${contacts.firstName} || ' ' || ${contacts.lastName}`,
      })
      .from(contacts)
      .where(and(isNull(contacts.tombstonedAt), isNull(contacts.mergedIntoId)))
      .orderBy(asc(contacts.firstName)),
  );
}

/* ------------------------------------------------- segment builder pickers */

/**
 * Enum lists, as options.
 *
 * These are typed in the database and therefore knowable without a query, so they
 * are constants rather than round trips. They live here so a screen never has to
 * hardcode an enum's values and drift when one is added — the source of truth is
 * `src/server/segments/schema.ts`, which is also what validates the submission.
 */
const titleCase = (s: string) =>
  s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

export function roleOptions() {
  return CONTACT_ROLES.map((value) => ({ value, label: titleCase(value) }));
}

export function intentTypeOptions() {
  return INTENT_TYPES.map((value) => ({ value, label: titleCase(value) }));
}

export function sentimentOptions() {
  return SENTIMENTS.map((value) => ({ value, label: titleCase(value) }));
}

export function propertyTypeOptions() {
  return PROPERTY_TYPES.map((value) => ({ value, label: titleCase(value) }));
}

/**
 * The values actually present in a free-text column.
 *
 * `timeline`, `finance_status` and `budget_band` have no pgEnum — they hold whatever
 * the extraction wrote ("Pre-approved", "Within 3 months", "Finance not started"). A
 * hand-written list of options would drift from the data the day the model phrases
 * something differently, and a filter offering a value no row holds returns zero with
 * no explanation.
 *
 * So the picker is built from the column. The count comes with it, because "Cash (1)"
 * tells an agent something a bare label does not.
 */
export type ObservedValue = { value: string; label: string; count: number };

async function distinctValues(
  column: "timeline" | "finance_status",
): Promise<ObservedValue[]> {
  return query(async (tx) => {
    /**
     * `timeline` exists on BOTH contact_preferences and contact_intent with no stated
     * precedence, and the segment predicate matches either — so the picker has to
     * offer the union, or an agent could not select a value that would have matched.
     */
    const rows =
      column === "timeline"
        ? await tx.execute<{ v: string; n: number }>(sql`
            select v, count(*)::int as n from (
              select nullif(trim(timeline), '') as v from contact_preferences
              union all
              select nullif(trim(timeline), '') as v from contact_intent
            ) t
            where v is not null
            group by v order by n desc, v asc limit 40`)
        : await tx.execute<{ v: string; n: number }>(sql`
            select nullif(trim(finance_status), '') as v, count(*)::int as n
            from contact_preferences
            where nullif(trim(finance_status), '') is not null
            group by 1 order by n desc, 1 asc limit 40`);

    return rows.map((r) => ({ value: r.v, label: `${r.v} (${r.n})`, count: r.n }));
  });
}

export const timelineOptions = () => distinctValues("timeline");
export const financeStatusOptions = () => distinctValues("finance_status");

/**
 * Campaigns worth suppressing against — ones that actually reached somebody.
 *
 * A campaign nobody was sent is not a reason to skip anyone, so offering it would be
 * a filter that silently does nothing.
 */
export async function sentCampaignOptions() {
  return query(async (tx) => {
    const rows = await tx.execute<{ id: string; name: string; n: number }>(sql`
      select c.id, c.name, count(r.id)::int as n
      from campaigns c
      join campaign_recipients r on r.campaign_id = c.id and r.sent_at is not null
      group by c.id, c.name
      order by max(r.sent_at) desc
      limit 25`);
    return rows.map((r) => ({
      value: r.id,
      label: `${r.name} (${r.n} sent)`,
    }));
  });
}

/** Saved segments, with their stored filter parsed into something applicable. */
export async function savedSegmentOptions() {
  return query(async (tx) => {
    const rows = await tx
      .select({
        id: savedViews.id,
        name: savedViews.name,
        description: savedViews.description,
        filter: savedViews.filter,
      })
      .from(savedViews)
      .orderBy(asc(savedViews.name));
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      filter: parseStoredFilter(r.filter),
      /**
       * Whether the stored jsonb was a real filter or the seed's placeholder
       * `{note: "..."}`. Shown in the UI, because "applies nothing" and "applies
       * something that finds nobody" look identical otherwise.
       */
      applicable: !isEmptySegment(parseStoredFilter(r.filter)),
    }));
  });
}

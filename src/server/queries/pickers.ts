import { asc, eq, isNull, and, sql } from "drizzle-orm";
import { query } from "@/db";
import { suburbs, properties, listings, contacts } from "@/db/schema";

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

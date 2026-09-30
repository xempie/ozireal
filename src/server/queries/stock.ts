import { and, desc, eq, gte, sql } from "drizzle-orm";
import { query } from "@/db";
import {
  properties,
  listings,
  listingMedia,
  inspections,
  inspectionRegistrations,
  suburbs,
  contacts,
  matches,
} from "@/db/schema";

/**
 * Stock reads.
 *
 * A listing is always returned with its address already joined, because every screen
 * that shows a listing shows where it is - and doing it here avoids the N+1 the
 * prototype's `listingAddress(l)` helper hid behind a synchronous lookup.
 */

const addressSql = sql<string>`
  trim(coalesce(${properties.streetNumber} || ' ', '') || coalesce(${properties.street}, ''))
  || ', ' || coalesce(${suburbs.name}, '')`;

export async function getProperties() {
  return query(async (tx) => {
    const rows = await tx
      .select({
        id: properties.id,
        address: sql<string>`trim(coalesce(${properties.streetNumber} || ' ', '') || coalesce(${properties.street}, ''))`,
        // The parts, not just the joined string: the edit dialog has to put the
        // unit and number back into their own inputs, and re-splitting a formatted
        // address is how "1/12A" becomes two wrong fields.
        unit: properties.unit,
        streetNumber: properties.streetNumber,
        street: properties.street,
        suburbId: properties.suburbId,
        suburb: suburbs.name,
        state: properties.state,
        postcode: properties.postcode,
        type: properties.propertyType,
        status: properties.status,
        beds: properties.beds,
        baths: properties.baths,
        parking: properties.parking,
        landSqm: properties.landAreaSqm,
        floorSqm: properties.floorAreaSqm,
        yearBuilt: properties.yearBuilt,
        condition: properties.condition,
        features: properties.features,
        ownerContactId: properties.ownerContactId,
        ownerName: sql<string | null>`${contacts.firstName} || ' ' || ${contacts.lastName}`,
        internalNotes: properties.internalNotes,
        internalPriceExpectation: properties.internalPriceExpectation,
        lat: properties.latitude,
        gnafPid: properties.gnafPid,
      })
      .from(properties)
      .leftJoin(suburbs, eq(suburbs.id, properties.suburbId))
      .leftJoin(contacts, eq(contacts.id, properties.ownerContactId))
      .orderBy(properties.createdAt);

    const ls = await tx
      .select({
        propertyId: listings.propertyId,
        id: listings.id,
        status: listings.status,
      })
      .from(listings);

    return rows.map((p) => ({
      ...p,
      listings: ls.filter((l) => l.propertyId === p.id),
    }));
  });
}

export async function getProperty(id: string) {
  const all = await getProperties();
  return all.find((p) => p.id === id) ?? null;
}

export async function getListings() {
  return query((tx) =>
    tx
      .select({
        id: listings.id,
        propertyId: listings.propertyId,
        address: addressSql,
        type: listings.listingType,
        method: listings.method,
        status: listings.status,
        priceDisplay: listings.priceDisplay,
        searchMin: listings.searchPriceMin,
        searchMax: listings.searchPriceMax,
        rentPw: listings.rentPw,
        headline: listings.publicHeadline,
        copy: listings.publicCopy,
        slug: listings.slug,
        listedAt: listings.listedAt,
        publishedAt: listings.publishedAt,
        soldAt: listings.soldAt,
        resultDisplay: listings.resultDisplay,
        views7d: listings.views7d,
        enquiries7d: listings.enquiries7d,
        photos: sql<number>`(
          select count(*)::int from ${listingMedia}
          where ${listingMedia.listingId} = ${listings.id} and ${listingMedia.kind} = 'photo'
        )`,
        hasFloorplan: sql<boolean>`exists (
          select 1 from ${listingMedia}
          where ${listingMedia.listingId} = ${listings.id} and ${listingMedia.kind} = 'floorplan'
        )`,
      })
      .from(listings)
      .innerJoin(properties, eq(properties.id, listings.propertyId))
      .leftJoin(suburbs, eq(suburbs.id, properties.suburbId))
      .orderBy(desc(listings.listedAt)),
  );
}

export async function getListing(id: string) {
  const all = await getListings();
  return all.find((l) => l.id === id) ?? null;
}

export async function getListingsForProperty(propertyId: string) {
  const all = await getListings();
  return all.filter((l) => l.propertyId === propertyId);
}

export async function getInspections(opts?: { upcomingOnly?: boolean }) {
  return query((tx) =>
    tx
      .select({
        id: inspections.id,
        listingId: inspections.listingId,
        capacity: inspections.capacity,
        address: addressSql,
        startsAt: inspections.startsAt,
        minutes: inspections.minutes,
        kind: inspections.kind,
        registrations: sql<number>`(
          select count(*)::int from ${inspectionRegistrations}
          where ${inspectionRegistrations.inspectionId} = ${inspections.id}
        )`,
      })
      .from(inspections)
      .innerJoin(listings, eq(listings.id, inspections.listingId))
      .innerJoin(properties, eq(properties.id, listings.propertyId))
      .leftJoin(suburbs, eq(suburbs.id, properties.suburbId))
      .where(
        opts?.upcomingOnly
          ? and(eq(inspections.cancelled, false), gte(inspections.startsAt, sql`now()`))
          : eq(inspections.cancelled, false),
      )
      .orderBy(inspections.startsAt),
  );
}

/** Listings that cannot go live, or should not have. */
export async function getListingsNeedingAttention() {
  const all = await getListings();
  return all.filter(
    (l) =>
      l.status === "draft" ||
      (l.status === "live" && (l.photos === 0 || !l.priceDisplay)),
  );
}

/* ---------------------------------------------------------------- matching */

/**
 * Matches are (property, contact) since 0017: a property can be matched with no
 * listing at all. listingId, priceDisplay and listingStatus are null for those.
 */
const matchSelect = {
  propertyId: matches.propertyId,
  listingId: matches.listingId,
  contactId: matches.contactId,
  score: matches.score,
  reason: matches.reason,
  stage: matches.stage,
};

export async function getMatchesForProperty(propertyId: string) {
  return query((tx) =>
    tx
      .select({
        ...matchSelect,
        contactFirstName: contacts.firstName,
        contactLastName: contacts.lastName,
      })
      .from(matches)
      .innerJoin(contacts, eq(contacts.id, matches.contactId))
      .where(eq(matches.propertyId, propertyId))
      .orderBy(desc(matches.score)),
  );
}

/** The matches for a listing's property (a listing is one campaign over it). */
export async function getMatchesForListing(listingId: string) {
  return query((tx) =>
    tx
      .select({
        ...matchSelect,
        contactFirstName: contacts.firstName,
        contactLastName: contacts.lastName,
      })
      .from(matches)
      .innerJoin(contacts, eq(contacts.id, matches.contactId))
      .where(sql`${matches.propertyId} = (select property_id from listings where id = ${listingId}::uuid)`)
      .orderBy(desc(matches.score)),
  );
}

export async function getMatchesForContact(contactId: string) {
  return query((tx) =>
    tx
      .select({
        ...matchSelect,
        address: addressSql,
        priceDisplay: listings.priceDisplay,
        listingStatus: listings.status,
      })
      .from(matches)
      .innerJoin(properties, eq(properties.id, matches.propertyId))
      .leftJoin(suburbs, eq(suburbs.id, properties.suburbId))
      .leftJoin(listings, eq(listings.id, matches.listingId))
      .where(eq(matches.contactId, contactId))
      .orderBy(desc(matches.score)),
  );
}

export async function getAllMatches() {
  return query((tx) =>
    tx
      .select({
        ...matchSelect,
        address: addressSql,
        contactFirstName: contacts.firstName,
        contactLastName: contacts.lastName,
      })
      .from(matches)
      .innerJoin(properties, eq(properties.id, matches.propertyId))
      .leftJoin(suburbs, eq(suburbs.id, properties.suburbId))
      .innerJoin(contacts, eq(contacts.id, matches.contactId))
      .orderBy(desc(matches.score)),
  );
}

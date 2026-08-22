import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  doublePrecision,
  boolean,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants, users } from "./tenancy";
import { contacts } from "./contacts";
import { propertyType, suburbs } from "./shared";

export { propertyType, suburbs };

/**
 * Stock. A property is the physical asset and outlives its campaigns; a listing is one
 * campaign over it. Keeping them apart is what lets the platform hold a full history -
 * sold 2019, leased 2022, for sale again now (CLAUDE.md §4).
 */

/**
 * The state of the ASSET, distinct from any campaign over it. §4: "Exists
 * independently of whether it is currently listed" - so a property that has never had
 * a listing still has to be able to say what it is.
 */
export const propertyStatus = pgEnum("property_status", [
  "prospect",
  "appraised",
  "off_market",
  "listed",
  "sold",
  "archived",
]);

export const listingType = pgEnum("listing_type", ["sale", "rent"]);

export const listingStatus = pgEnum("listing_status", [
  "draft",
  "live",
  "under_offer",
  "sold",
  "leased",
  "withdrawn",
]);

export const mediaKind = pgEnum("media_kind", ["photo", "floorplan", "video"]);
export const inspectionKind = pgEnum("inspection_kind", ["open", "private"]);

export const properties = pgTable(
  "properties",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),

    // Structured address, not free text - suburb filtering has to actually work.
    unit: text("unit"),
    streetNumber: text("street_number"),
    street: text("street"),
    suburbId: uuid("suburb_id").references(() => suburbs.id, { onDelete: "restrict" }),
    state: text("state").notNull().default("SA"),
    postcode: text("postcode"),

    /** Reserved for the national address identifier. G-NAF is deferred (D11), so a
     *  backfill later is a job rather than a migration. */
    gnafPid: text("gnaf_pid"),
    gnafMatchedAt: timestamp("gnaf_matched_at", { withTimezone: true }),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    geocodedAt: timestamp("geocoded_at", { withTimezone: true }),
    geocodeSource: text("geocode_source"),

    propertyType: propertyType("property_type").notNull(),
    /** Never derived from listings - see propertyStatus above. */
    status: propertyStatus("status").notNull().default("prospect"),
    beds: integer("beds"),
    baths: integer("baths"),
    parking: integer("parking"),
    landAreaSqm: integer("land_area_sqm"),
    floorAreaSqm: integer("floor_area_sqm"),
    yearBuilt: integer("year_built"),
    condition: text("condition"),
    features: text("features").array(),

    ownerContactId: uuid("owner_contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),

    /**
     * Internal only. Rule 8: public routes read named projections that cannot return
     * these columns, and a test asserts it. One `select *` on a public page would
     * publish a vendor's price expectation.
     */
    internalNotes: text("internal_notes"),
    internalPriceExpectation: text("internal_price_expectation"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("properties_tenant_idx").on(t.tenantId),
    index("properties_suburb_idx").on(t.suburbId),
    index("properties_owner_idx").on(t.ownerContactId),
  ],
);

export const listings = pgTable(
  "listings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "restrict" }),

    listingType: listingType("listing_type").notNull(),
    method: text("method"),
    status: listingStatus("status").notNull().default("draft"),

    /**
     * The advertised wording, exactly as the agent authored it: "Offers above
     * $750,000", "Contact agent". Under-quoting provisions make the displayed text a
     * legal artefact, so it is stored and rendered verbatim and NEVER composed from a
     * number (§4, §16).
     */
    priceDisplay: text("price_display"),
    /** Hidden. Drives search filters only, never displayed. */
    searchPriceMin: integer("search_price_min"),
    searchPriceMax: integer("search_price_max"),
    rentPw: integer("rent_pw"),
    availableFrom: timestamp("available_from", { withTimezone: true }),

    /** Public copy, deliberately separate from the property's internal notes. */
    publicHeadline: text("public_headline"),
    publicCopy: text("public_copy"),

    /** Stable and never reused, so an old link never lands on someone else's property. */
    slug: text("slug").notNull(),

    listedAt: timestamp("listed_at", { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    soldAt: timestamp("sold_at", { withTimezone: true }),
    /** The result, only where the agent has chosen to display it. */
    resultDisplay: text("result_display"),

    /**
     * Rollup counters the public site refreshes. Denormalised on purpose: the console
     * renders these on five screens and divides them into a conversion rate, and a
     * per-request fact table is Phase 2B work. A page_views table can back them later
     * without changing any of the read paths.
     */
    views7d: integer("views_7d").notNull().default(0),
    enquiries7d: integer("enquiries_7d").notNull().default(0),
    trafficRefreshedAt: timestamp("traffic_refreshed_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("listings_slug_uq").on(t.tenantId, t.slug),
    // At most one live campaign per property at a time.
    uniqueIndex("listings_one_live_per_property_uq")
      .on(t.propertyId)
      .where(sql`${t.status} in ('live','under_offer')`),
    index("listings_tenant_status_idx").on(t.tenantId, t.status),
    index("listings_property_idx").on(t.propertyId),
    index("listings_search_idx").on(t.tenantId, t.listingType, t.searchPriceMin),
  ],
);

export const listingMedia = pgTable(
  "listing_media",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    s3Key: text("s3_key").notNull(),
    kind: mediaKind("kind").notNull().default("photo"),
    sortOrder: integer("sort_order").notNull().default(0),
    altText: text("alt_text"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("listing_media_listing_idx").on(t.listingId, t.sortOrder)],
);

export const inspections = pgTable(
  "inspections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    minutes: integer("minutes").notNull().default(30),
    kind: inspectionKind("kind").notNull().default("open"),
    capacity: integer("capacity"),
    cancelled: boolean("cancelled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("inspections_listing_idx").on(t.listingId, t.startsAt)],
);

export const inspectionRegistrations = pgTable(
  "inspection_registrations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    inspectionId: uuid("inspection_id")
      .notNull()
      .references(() => inspections.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    registeredAt: timestamp("registered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    attended: boolean("attended"),
  },
  (t) => [
    uniqueIndex("inspection_registrations_uq").on(t.inspectionId, t.contactId),
    index("inspection_registrations_tenant_idx").on(t.tenantId),
  ],
);

/** Reserved for the agent who owns a listing, once multi-user arrives. */
export const listingAgents = pgTable(
  "listing_agents",
  {
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("listing_agents_uq").on(t.listingId, t.userId)],
);

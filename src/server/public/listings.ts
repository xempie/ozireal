import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { listings, properties, suburbs, inspections } from "@/db/schema";
import { publicQuery } from "./tenant";

/**
 * What the public site is allowed to know about a listing.
 *
 * ## Rule 8, in one file
 *
 * `properties` carries `owner_contact_id`, `internal_notes` and
 * `internal_price_expectation`. One `select *` on a public route publishes a vendor's
 * price expectation and the identity of the owner. So nothing here selects a row: every
 * query names every column it returns, and `PUBLIC_LISTING_FIELDS` below is the
 * allow-list a test asserts against.
 *
 * Widening any of these is on §15's human-sign-off list. The test is what makes that
 * a conversation rather than a silent commit.
 *
 * ## The price is a string
 *
 * `price_display` is authored by the agent and rendered verbatim — under-quoting
 * provisions make the displayed wording a legal artefact. `search_price_min/max` exist
 * to drive filters and are **never returned to a page**. They are usable in a `where`
 * inside this file and nowhere else, which is why filtering lives here too.
 */

/** Every key a public listing projection may contain. Asserted by tests/public-boundary. */
export const PUBLIC_LISTING_FIELDS = [
  "id",
  "slug",
  "type",
  "status",
  "method",
  "priceDisplay",
  "resultDisplay",
  "headline",
  "copy",
  "address",
  "streetAddress",
  "suburb",
  "state",
  "postcode",
  "propertyType",
  "beds",
  "baths",
  "parking",
  "landSqm",
  "publishedAt",
  "soldAt",
] as const;

export type PublicListing = {
  id: string;
  slug: string;
  type: "sale" | "rent";
  status: string;
  method: string | null;
  priceDisplay: string | null;
  resultDisplay: string | null;
  headline: string | null;
  copy: string | null;
  /** "12 Powell Street, Norwood SA 5067" — for titles and cards. */
  address: string;
  /** "12 Powell Street" — schema.org streetAddress, and the card's first line. */
  streetAddress: string;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
  propertyType: string;
  beds: number | null;
  baths: number | null;
  parking: number | null;
  landSqm: number | null;
  publishedAt: Date | null;
  soldAt: Date | null;
};

/**
 * On the market. `under_offer` is included on purpose — the property is still being
 * advertised and the badge says so; removing it would make a listing vanish at the most
 * interesting moment of its campaign.
 */
const ON_MARKET = ["live", "under_offer"] as const;

/** The archive. Never deleted — §16 calls it the site's best organic asset. */
const SETTLED = ["sold", "leased"] as const;

const streetSql = sql<string>`
  trim(
    coalesce(${properties.unit} || '/', '') ||
    coalesce(${properties.streetNumber} || ' ', '') ||
    coalesce(${properties.street}, '')
  )`;

const addressSql = sql<string>`
  trim(
    coalesce(${properties.unit} || '/', '') ||
    coalesce(${properties.streetNumber} || ' ', '') ||
    coalesce(${properties.street}, '')
  )
  || coalesce(', ' || ${suburbs.name}, '')
  || coalesce(' ' || ${properties.state}, '')
  || coalesce(' ' || ${properties.postcode}, '')`;

/**
 * The projection, written once.
 *
 * Every public query selects exactly this. A second, slightly different select list is
 * how one page ends up returning a column the others do not — so there is only one.
 */
const publicSelect = {
  id: listings.id,
  slug: listings.slug,
  type: listings.listingType,
  status: listings.status,
  method: listings.method,
  priceDisplay: listings.priceDisplay,
  resultDisplay: listings.resultDisplay,
  headline: listings.publicHeadline,
  copy: listings.publicCopy,
  address: addressSql,
  streetAddress: streetSql,
  suburb: suburbs.name,
  state: properties.state,
  postcode: properties.postcode,
  propertyType: properties.propertyType,
  beds: properties.beds,
  baths: properties.baths,
  parking: properties.parking,
  landSqm: properties.landAreaSqm,
  publishedAt: listings.publishedAt,
  soldAt: listings.soldAt,
};

function base(tx: Parameters<Parameters<typeof publicQuery>[0]>[0]) {
  return tx
    .select(publicSelect)
    .from(listings)
    .innerJoin(properties, eq(properties.id, listings.propertyId))
    .leftJoin(suburbs, eq(suburbs.id, properties.suburbId));
}

/* ------------------------------------------------------------------ search */

export type ListingSearch = {
  listingType?: "sale" | "rent";
  suburbSlugs?: string[];
  priceMin?: number;
  priceMax?: number;
  bedsMin?: number;
  bathsMin?: number;
  parkingMin?: number;
  propertyTypes?: string[];
  /** 1-based. Pagination is real links, because a crawler cannot scroll. */
  page?: number;
  perPage?: number;
  sort?: "newest" | "price-asc" | "price-desc";
};

export type SearchResult = {
  results: PublicListing[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
};

const PER_PAGE = 12;

export async function searchListings(s: ListingSearch): Promise<SearchResult> {
  const page = Math.max(1, s.page ?? 1);
  const perPage = Math.min(48, Math.max(1, s.perPage ?? PER_PAGE));

  return publicQuery(async (tx) => {
    const where = [inArray(listings.status, [...ON_MARKET])];

    if (s.listingType) where.push(eq(listings.listingType, s.listingType));

    /**
     * Price filtering reads the hidden numeric columns and — for a rental — `rent_pw`
     * instead. Matching a weekly rent against a sale price band is how a $550/wk rental
     * lands in a "$500,000 to $700,000" search, which happened in the matcher once
     * already.
     */
    if (s.priceMin !== undefined) {
      where.push(
        s.listingType === "rent"
          ? sql`coalesce(${listings.rentPw}, 0) >= ${s.priceMin}`
          : sql`coalesce(${listings.searchPriceMax}, ${listings.searchPriceMin}) >= ${s.priceMin}`,
      );
    }
    if (s.priceMax !== undefined) {
      where.push(
        s.listingType === "rent"
          ? sql`coalesce(${listings.rentPw}, 0) <= ${s.priceMax}`
          : sql`coalesce(${listings.searchPriceMin}, ${listings.searchPriceMax}) <= ${s.priceMax}`,
      );
    }

    if (s.bedsMin !== undefined) where.push(sql`${properties.beds} >= ${s.bedsMin}`);
    if (s.bathsMin !== undefined) where.push(sql`${properties.baths} >= ${s.bathsMin}`);
    if (s.parkingMin !== undefined) {
      where.push(sql`${properties.parking} >= ${s.parkingMin}`);
    }
    if (s.propertyTypes?.length) {
      where.push(inArray(properties.propertyType, s.propertyTypes as never[]));
    }
    if (s.suburbSlugs?.length) {
      where.push(inArray(sql`lower(${suburbs.name})`, s.suburbSlugs.map((x) => x.toLowerCase())));
    }

    const predicate = and(...where);

    const [count] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(listings)
      .innerJoin(properties, eq(properties.id, listings.propertyId))
      .leftJoin(suburbs, eq(suburbs.id, properties.suburbId))
      .where(predicate);

    const order =
      s.sort === "price-asc"
        ? sql`coalesce(${listings.searchPriceMin}, ${listings.rentPw}, 0) asc`
        : s.sort === "price-desc"
          ? sql`coalesce(${listings.searchPriceMin}, ${listings.rentPw}, 0) desc`
          : desc(listings.publishedAt);

    const results = await base(tx)
      .where(predicate)
      .orderBy(order, desc(listings.id))
      .limit(perPage)
      .offset((page - 1) * perPage);

    const total = count?.n ?? 0;
    return {
      results,
      total,
      page,
      perPage,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
    };
  });
}

/* ------------------------------------------------------------- one listing */

/**
 * By slug. Returns settled listings too, so a sold campaign keeps its page — the URL was
 * shared and indexed, and a 404 throws that away. The page renders the result instead.
 */
export async function listingBySlug(slug: string): Promise<PublicListing | null> {
  return publicQuery(async (tx) => {
    const [row] = await base(tx)
      .where(
        and(
          eq(listings.slug, slug),
          inArray(listings.status, [...ON_MARKET, ...SETTLED]),
        ),
      )
      .limit(1);
    return row ?? null;
  });
}

/** Every slug the sitemap should carry, and what `generateStaticParams` builds. */
export async function publicListingSlugs(): Promise<
  { slug: string; type: "sale" | "rent"; updatedAt: Date | null }[]
> {
  return publicQuery((tx) =>
    tx
      .select({
        slug: listings.slug,
        type: listings.listingType,
        updatedAt: listings.updatedAt,
      })
      .from(listings)
      .where(inArray(listings.status, [...ON_MARKET, ...SETTLED]))
      .orderBy(desc(listings.updatedAt)),
  );
}

/* --------------------------------------------------------------- archive */

export async function soldAndLeased(limit = 60): Promise<PublicListing[]> {
  return publicQuery((tx) =>
    base(tx)
      .where(inArray(listings.status, [...SETTLED]))
      .orderBy(desc(listings.soldAt))
      .limit(limit),
  );
}

/* ----------------------------------------------------------- inspections */

export type PublicInspection = {
  id: string;
  startsAt: Date;
  minutes: number;
  kind: string;
};

/**
 * Open homes for one listing. Cancelled ones are excluded and past ones are not shown —
 * an inspection time that has been and gone reads as a live invitation.
 */
export async function inspectionsForListing(
  listingId: string,
): Promise<PublicInspection[]> {
  return publicQuery((tx) =>
    tx
      .select({
        id: inspections.id,
        startsAt: inspections.startsAt,
        minutes: inspections.minutes,
        kind: inspections.kind,
      })
      .from(inspections)
      .where(
        and(
          eq(inspections.listingId, listingId),
          eq(inspections.cancelled, false),
          sql`${inspections.startsAt} >= now()`,
        ),
      )
      .orderBy(inspections.startsAt),
  );
}

/* ------------------------------------------------------------- home page */

/** What is on the market right now, newest first. The home page strip. */
export async function onMarket(limit = 8): Promise<PublicListing[]> {
  return publicQuery((tx) =>
    base(tx)
      .where(inArray(listings.status, [...ON_MARKET]))
      .orderBy(desc(listings.publishedAt), desc(listings.id))
      .limit(limit),
  );
}

/** How many are actually available — the home page states it rather than implying. */
export async function onMarketCount(): Promise<number> {
  return publicQuery(async (tx) => {
    const [row] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(listings)
      .where(inArray(listings.status, [...ON_MARKET]));
    return row?.n ?? 0;
  });
}

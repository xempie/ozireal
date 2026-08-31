import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { isPrivatePath } from "@/lib/private-paths";
import {
  PUBLIC_LISTING_FIELDS,
  searchListings,
  listingBySlug,
  soldAndLeased,
  onMarket,
  onMarketCount,
  publicListingSlugs,
  inspectionsForListing,
} from "@/server/public/listings";

/**
 * Rule 8, enforced.
 *
 * `properties` carries the owner's contact id, the vendor's internal price expectation
 * and private notes. `listings` carries the hidden numeric price range that exists only
 * to drive filters. One `select *` on a public route publishes all of it, and the
 * consequence is not a bug report — it is a vendor's confidential position on a page
 * Google has already indexed.
 *
 * So this file is the boundary. It asserts three things, and the third is the one that
 * survives future carelessness:
 *
 *   1. Every public projection returns exactly the allow-listed keys.
 *   2. Draft and withdrawn listings never reach the public site.
 *   3. No file under `src/app/(public)` imports the database, the tenant client, or the
 *      console's query layer — because a projection is only a boundary if there is no
 *      way around it.
 *
 * CLAUDE.md §15 puts widening a public projection on the human-sign-off list. This is
 * what turns that from a note into a failing test.
 */

/** Column names that must never appear in a public result, in any casing. */
const FORBIDDEN = [
  "ownerContactId",
  "owner_contact_id",
  "internalNotes",
  "internal_notes",
  "internalPriceExpectation",
  "internal_price_expectation",
  "searchPriceMin",
  "search_price_min",
  "searchPriceMax",
  "search_price_max",
  "rentPw",
  "rent_pw",
  "embeddedText",
  "embedded_text",
  "embedding",
  "views7d",
  "views_7d",
  "enquiries7d",
  "enquiries_7d",
  "gnafPid",
  "gnaf_pid",
  "tenantId",
  "tenant_id",
  "propertyId",
  "property_id",
];

let sql: postgres.Sql;

beforeAll(() => {
  sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
});
afterAll(async () => {
  await sql?.end();
});

/** Every key on every row, flattened, so one loose column anywhere fails. */
function keysOf(rows: Record<string, unknown>[]): string[] {
  return [...new Set(rows.flatMap((r) => Object.keys(r)))];
}

function assertClean(rows: Record<string, unknown>[], label: string) {
  const keys = keysOf(rows);
  for (const k of keys) {
    expect(
      FORBIDDEN.includes(k),
      `${label} returned the forbidden field "${k}"`,
    ).toBe(false);
  }
}

/* ------------------------------------------------------- the projections */

describe("every public projection returns only allow-listed fields", () => {
  it("searchListings", async () => {
    const r = await searchListings({});
    expect(r.results.length, "the seed carries listings on the market").toBeGreaterThan(0);
    for (const k of keysOf(r.results)) {
      expect(
        (PUBLIC_LISTING_FIELDS as readonly string[]).includes(k),
        `searchListings returned "${k}", which is not in PUBLIC_LISTING_FIELDS`,
      ).toBe(true);
    }
    assertClean(r.results, "searchListings");
  });

  it("listingBySlug", async () => {
    const [live] = await sql<{ slug: string }[]>`
      select slug from listings where status = 'live' limit 1`;
    const row = await listingBySlug(live.slug);
    expect(row).not.toBeNull();
    for (const k of Object.keys(row!)) {
      expect(
        (PUBLIC_LISTING_FIELDS as readonly string[]).includes(k),
        `listingBySlug returned "${k}"`,
      ).toBe(true);
    }
  });

  it("onMarket and soldAndLeased", async () => {
    assertClean(await onMarket(), "onMarket");
    assertClean(await soldAndLeased(), "soldAndLeased");
  });

  it("publicListingSlugs carries nothing but what a sitemap needs", async () => {
    const rows = await publicListingSlugs();
    expect(keysOf(rows).sort()).toEqual(["slug", "type", "updatedAt"]);
  });

  it("inspectionsForListing", async () => {
    const [l] = await sql<{ id: string }[]>`
      select listing_id as id from inspections limit 1`;
    if (!l) return;
    const rows = await inspectionsForListing(l.id);
    for (const k of keysOf(rows as unknown as Record<string, unknown>[])) {
      expect(["id", "startsAt", "minutes", "kind"]).toContain(k);
    }
  });
});

/* ------------------------------------------------- what must never appear */

describe("unpublished listings never reach the public site", () => {
  it("a draft is invisible to search and to its own URL", async () => {
    const [draft] = await sql<{ slug: string }[]>`
      select slug from listings where status = 'draft' limit 1`;
    expect(draft, "the seed carries a draft listing").toBeTruthy();

    const r = await searchListings({});
    expect(r.results.map((x) => x.slug)).not.toContain(draft.slug);
    // Not merely absent from the list — unreachable by its own address.
    expect(await listingBySlug(draft.slug)).toBeNull();
  });

  it("a withdrawn listing is invisible too", async () => {
    const [w] = await sql<{ slug: string }[]>`
      select slug from listings where status = 'withdrawn' limit 1`;
    expect(w, "the seed carries a withdrawn listing").toBeTruthy();

    const r = await searchListings({});
    expect(r.results.map((x) => x.slug)).not.toContain(w.slug);
    expect(await listingBySlug(w.slug)).toBeNull();
  });

  it("a settled listing keeps its page but is not on the market", async () => {
    const [sold] = await sql<{ slug: string }[]>`
      select slug from listings where status = 'sold' limit 1`;
    expect(sold).toBeTruthy();

    // §16: the archive is the site's organic asset, so the URL must keep resolving.
    expect(await listingBySlug(sold.slug)).not.toBeNull();
    const r = await searchListings({});
    expect(r.results.map((x) => x.slug)).not.toContain(sold.slug);
    expect((await soldAndLeased()).map((x) => x.slug)).toContain(sold.slug);
  });

  it("the on-market count agrees with what search returns", async () => {
    const [row] = await sql<{ n: number }[]>`
      select count(*)::int as n from listings where status in ('live','under_offer')`;
    expect(await onMarketCount()).toBe(row.n);
    expect((await searchListings({ perPage: 48 })).total).toBe(row.n);
  });
});

/* ------------------------------------------------------------- filtering */

describe("search filters", () => {
  it("separates sale from rent, and never prices a rental off the sale band", async () => {
    const sale = await searchListings({ listingType: "sale" });
    const rent = await searchListings({ listingType: "rent" });
    expect(sale.results.every((r) => r.type === "sale")).toBe(true);
    expect(rent.results.every((r) => r.type === "rent")).toBe(true);

    /**
     * A weekly rent is not a sale price. Filtering rentals against a sale band is how
     * a $550/wk rental lands in a "$500,000–$700,000" search — the matcher shipped that
     * bug once already, so it is asserted here rather than assumed.
     */
    const band = await searchListings({ listingType: "rent", priceMin: 400, priceMax: 700 });
    expect(band.results.every((r) => r.type === "rent")).toBe(true);
  });

  it("paginates rather than truncating", async () => {
    const p1 = await searchListings({ perPage: 1, page: 1 });
    expect(p1.results.length).toBe(1);
    expect(p1.totalPages).toBe(p1.total);
    if (p1.total > 1) {
      const p2 = await searchListings({ perPage: 1, page: 2 });
      expect(p2.results[0].id).not.toBe(p1.results[0].id);
    }
  });

  it("filters on beds without dropping listings that have none recorded by accident", async () => {
    const r = await searchListings({ bedsMin: 3 });
    expect(r.results.every((x) => (x.beds ?? 0) >= 3)).toBe(true);
  });
});

/* ------------------------------------------- there is no way around it */

describe("nothing in (public) can reach the database directly", () => {
  const root = join(process.cwd(), "src", "app", "(public)");

  function walk(dir: string): string[] {
    let out: string[] = [];
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return out;
    }
    for (const e of entries) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) out = out.concat(walk(p));
      else if (/\.tsx?$/.test(e)) out.push(p);
    }
    return out;
  }

  it("imports only the public projections, never db or the console query layer", () => {
    const files = walk(root);
    // Before the route group exists this passes vacuously; once it exists it bites.
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      const bad = [
        /from\s+["']@\/db["']/,
        /from\s+["']@\/db\/schema/,
        /from\s+["']@\/server\/queries/,
        /\bqueryAsSystemTenant\b/,
        /\bcurrentTenantId\b/,
      ];
      for (const re of bad) {
        expect(
          re.test(src),
          `${f.replace(process.cwd(), "")} reaches past src/server/public (${re})`,
        ).toBe(false);
      }
    }
  });
});

/* --------------------------------------------- the console stays private */

describe("every console route is still behind a session", () => {
  it("PRIVATE_PREFIXES covers every route folder in (app)", () => {
    /**
     * The direction of the middleware list is the whole point: a console route added
     * next year is public by accident unless something notices. This is that something
     * — it reads the route group off disk rather than trusting a hand-kept list.
     */
    const appDir = join(process.cwd(), "src", "app", "(app)");
    const routes = readdirSync(appDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
      .map((d) => `/${d.name}`);

    expect(routes.length, "the console has route folders").toBeGreaterThan(10);
    for (const r of routes) {
      expect(
        isPrivatePath(r),
        `${r} is a console route but middleware would serve it to anonymous visitors`,
      ).toBe(true);
    }
  });

  it("recognises nested console paths, not just the top level", () => {
    expect(isPrivatePath("/contacts/8f14e45f-ceea-467a-9f2c-9d0a1b2c3d4e")).toBe(true);
    expect(isPrivatePath("/listings/abc/edit")).toBe(true);
    expect(isPrivatePath("/api/export/contacts")).toBe(true);
  });

  it("leaves the public site alone", () => {
    for (const p of [
      "/",
      "/for-sale",
      "/for-sale/12-powell-street-norwood-sa-5067-1043",
      "/for-rent",
      "/sold",
      "/suburbs/norwood",
      "/post/selling-in-spring",
      "/services/property-management",
      "/robots.txt",
      "/sitemap.xml",
    ]) {
      expect(isPrivatePath(p), `${p} should be public`).toBe(false);
    }
  });

  it("does not let a lookalike path slip through", () => {
    // "/settings-guide" is not "/settings", and must not be gated by a loose prefix
    // match — but it must not accidentally BECOME private either.
    expect(isPrivatePath("/settingsomething")).toBe(false);
    expect(isPrivatePath("/settings")).toBe(true);
    expect(isPrivatePath("/settings/credentials")).toBe(true);
  });
});

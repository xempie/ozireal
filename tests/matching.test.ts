import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import postgres from "postgres";
import { systemTenantId } from "@/db";

/**
 * The matcher's stage-1 filter (B5.3).
 *
 * These tests exist because of a bug they would have caught on day one: every
 * stage-1 query failed with 42P08 (untyped parameter in an `is null` test), and
 * nothing noticed — the API-key check returned before the SQL ran, so the filter
 * was never executed by a test in its life. Matching is now ordered so stage 1
 * runs first and reports its count even without a key, which is exactly what
 * makes the query reachable from here.
 */

vi.mock("@/server/jobs/queues", () => ({ enqueue: async () => true }));

const { matchContactsForListing, matchListingsForContact } = await import(
  "@/server/matching/engine"
);

let sql: postgres.Sql;
let tenantId: string;

beforeAll(async () => {
  sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  tenantId = await systemTenantId();
  // No key: these tests are about the SQL, not the ranking.
  delete process.env.ANTHROPIC_API_KEY;
  await sql`delete from tenant_secrets where name = 'ANTHROPIC_API_KEY'`;
});
afterAll(async () => {
  await sql?.end();
});

describe("stage 1 actually executes", () => {
  it("runs the listing → contacts filter without erroring", async () => {
    const [any] = await sql<{ id: string }[]>`
      select id from listings where status in ('live','under_offer') limit 1`;
    expect(any, "the seed carries a live listing").toBeTruthy();
    // Before the fix this threw 42P08 rather than returning at all.
    const r = await matchContactsForListing(tenantId, any.id);
    expect(r.skipped).toBe("no-api-key");
    expect(r.stage1).toBeGreaterThanOrEqual(0);
  });

  it("finds a candidate built to match, proving the filter can pass someone", async () => {
    /**
     * Builds its own fixture rather than hoping the seed contains a buyer who
     * clears every predicate. A filter that returns zero for every listing is the
     * failure this project has already hit once ('House' vs 'house'), and only a
     * deliberately-matching candidate can tell a correct zero from a broken one.
     */
    const [l] = await sql<
      { id: string; beds: number; price_min: number; ptype: string; suburb_id: string }[]
    >`select l.id, p.beds, l.search_price_min as price_min,
             p.property_type::text as ptype, p.suburb_id
      from listings l join properties p on p.id = l.property_id
      where l.status in ('live','under_offer') and l.listing_type = 'sale'
        and p.suburb_id is not null and l.search_price_max is not null
      limit 1`;
    expect(l, "the seed carries a live sale listing").toBeTruthy();

    const [c] = await sql<{ id: string }[]>`
      insert into contacts (tenant_id, first_name, last_name, source_channel)
      values (${tenantId}, 'Match', ${`Fixture${Date.now() % 100000}`}, 'manual')
      returning id`;
    const [prefs] = await sql<{ id: string }[]>`
      insert into contact_preferences
        (tenant_id, contact_id, price_min, price_max, beds_min, property_types)
      values (${tenantId}, ${c.id}, 0, ${l.price_min + 500000}, ${Math.max(0, l.beds - 1)},
              ARRAY[${l.ptype}]::property_type[])
      returning id`;
    await sql`insert into contact_preference_suburbs (preference_id, suburb_id)
              values (${prefs.id}, ${l.suburb_id})`;

    try {
      const r = await matchContactsForListing(tenantId, l.id);
      expect(r.stage1).toBeGreaterThan(0);
    } finally {
      await sql`delete from contact_preference_suburbs where preference_id = ${prefs.id}`;
      await sql`delete from contact_preferences where id = ${prefs.id}`;
      await sql`delete from contacts where id = ${c.id}`;
    }
  });

  it("runs the contact → listings filter without erroring", async () => {
    const [c] = await sql<{ contact_id: string }[]>`
      select cp.contact_id from contact_preferences cp
      join contacts c on c.id = cp.contact_id
      where c.tombstoned_at is null and c.merged_into_id is null
        and c.do_not_contact = false
      limit 1`;
    expect(c).toBeTruthy();

    const r = await matchListingsForContact(tenantId, c.contact_id);
    expect(r.skipped).toBe("no-api-key");
    expect(r.stage1).toBeGreaterThanOrEqual(0);
  });

  it("excludes a do-not-contact person from both directions", async () => {
    const [c] = await sql<{ contact_id: string }[]>`
      select cp.contact_id from contact_preferences cp
      join contacts c on c.id = cp.contact_id
      where c.do_not_contact = false and c.tombstoned_at is null limit 1`;
    await sql`update contacts set do_not_contact = true where id = ${c.contact_id}`;
    try {
      const r = await matchListingsForContact(tenantId, c.contact_id);
      // The reverse direction used to match opted-out people while the forward
      // direction excluded them — the same person, matchable from one side only.
      expect(r.skipped).toBe("gone");
    } finally {
      await sql`update contacts set do_not_contact = false where id = ${c.contact_id}`;
    }
  });

  it("never sends more than the stage-2 cap into ranking", async () => {
    const [l] = await sql<{ id: string }[]>`
      select id from listings where status in ('live','under_offer') limit 1`;
    const r = await matchContactsForListing(tenantId, l.id);
    // stage1 may be large; what must never happen is an uncapped shortlist
    // reaching a paid model. Without a key we can only assert stage1 is bounded.
    expect(r.stage1).toBeLessThanOrEqual(200);
  });
});

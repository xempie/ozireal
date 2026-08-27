import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import postgres from "postgres";
import { systemTenantId } from "@/db";

/**
 * Campaign, content and proposal creation.
 *
 * The rule these three share is that NOTHING here can produce something a person
 * receives. Each one is a draft, and only ever a draft — §7 puts the send behind
 * the approval queue and a consent re-check. A test that only asserted the row
 * exists would pass on a version that also sent it.
 */

vi.mock("@/server/jobs/queues", () => ({ enqueue: async () => true }));

const h = vi.hoisted(() => ({
  session: {
    user: { id: "", name: "Sam", email: "sam@ozirealty.com.au", tenantId: "", role: "principal" },
  } as { user: Record<string, string> } | null,
}));
vi.mock("@/auth", () => ({ auth: async () => h.session }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

const { createCampaign } = await import("@/server/actions/campaigns");
const { createBlogPost, createSocialPost } = await import("@/server/actions/content");
const { createProposal } = await import("@/server/actions/proposals");

let sql: postgres.Sql;
let tenantId: string;
let contactId: string;
let listingId: string;

beforeAll(async () => {
  sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  tenantId = await systemTenantId();
  const [u] = await sql<{ id: string }[]>`select id from users limit 1`;
  h.session!.user.tenantId = tenantId;
  h.session!.user.id = u.id;
  const [c] = await sql<{ id: string }[]>`
    select id from contacts where tombstoned_at is null and merged_into_id is null limit 1`;
  contactId = c.id;
  const [l] = await sql<{ id: string }[]>`select id from listings limit 1`;
  listingId = l.id;
});
afterAll(async () => {
  await sql?.end();
});

describe("new campaign", () => {
  it("is a draft that has not been sent", async () => {
    const r = await createCampaign({ name: "Spring launch", channel: "email" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [row] = await sql<{ status: string; sent_at: Date | null }[]>`
      select status, sent_at from campaigns where id = ${r.data.id}`;
    expect(row.status).toBe("draft");
    // The column that would betray a send path hiding in the create action.
    expect(row.sent_at).toBeNull();
  });

  it("seeds recipients from the listing's matches when asked", async () => {
    const [{ n }] = await sql<{ n: number }[]>`
      select count(*)::int as n from matches where listing_id = ${listingId}`;
    const r = await createCampaign({
      name: "Matched buyers",
      channel: "email",
      listingId,
      seedFromMatches: true,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [{ got }] = await sql<{ got: number }[]>`
      select count(*)::int as got from campaign_recipients where campaign_id = ${r.data.id}`;
    expect(got).toBeLessThanOrEqual(n);
    if (n > 0) expect(got).toBeGreaterThan(0);
  });

  it("does NOT filter unsubscribed people out of a seeded list", async () => {
    /**
     * Deliberate, and the opposite of what looks careful.
     *
     * Consent is checked at the instant of sending. Someone dropped silently at
     * draft time is someone the send gate never gets to block and log — and the
     * block record is what proves a message was withheld rather than lost.
     */
    const [{ n }] = await sql<{ n: number }[]>`
      select count(*)::int as n
      from matches m
      join consents c on c.contact_id = m.contact_id and c.channel = 'email'
      where m.listing_id = ${listingId} and c.status <> 'granted'`;
    const r = await createCampaign({
      name: "Consent shape", channel: "email", listingId, seedFromMatches: true,
    });
    expect(r.ok).toBe(true);
    if (!r.ok || n === 0) return;
    const [{ kept }] = await sql<{ kept: number }[]>`
      select count(*)::int as kept
      from campaign_recipients cr
      join consents c on c.contact_id = cr.contact_id and c.channel = 'email'
      where cr.campaign_id = ${r.data.id} and c.status <> 'granted'`;
    expect(kept).toBe(n);
  });

  it("refuses to seed from matches with no listing chosen", async () => {
    const r = await createCampaign({ name: "Nowhere", channel: "sms", seedFromMatches: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/pick a listing/i);
  });

  it("leaves a tombstoned contact off a seeded list", async () => {
    const [gone] = await sql<{ id: string }[]>`
      insert into contacts (tenant_id, first_name, last_name, source_channel, tombstoned_at)
      values (${tenantId}, 'Removed', ${`Person${Date.now() % 100000}`}, 'manual', now())
      returning id`;
    await sql`
      insert into matches (tenant_id, listing_id, contact_id, score, reason, stage)
      values (${tenantId}, ${listingId}, ${gone.id}, 0.9, 'test row', 'filter')`;
    const r = await createCampaign({
      name: "Tombstone check", channel: "email", listingId, seedFromMatches: true,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [{ n }] = await sql<{ n: number }[]>`
      select count(*)::int as n from campaign_recipients
      where campaign_id = ${r.data.id} and contact_id = ${gone.id}`;
    expect(n).toBe(0);
  });
});

describe("new content draft", () => {
  it("creates an article as a draft, with a word count taken from the body", async () => {
    const title = `Selling in spring ${Date.now() % 100000}`;
    const r = await createBlogPost({ title, body: "One two three four five." });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [row] = await sql<
      { status: string; word_count: number; published_at: Date | null; slug: string }[]
    >`select status, word_count, published_at, slug from blog_posts where id = ${r.data.id}`;
    expect(row.status).toBe("draft");
    expect(row.word_count).toBe(5);
    // published_at means "a reader could see this", and nobody could.
    expect(row.published_at).toBeNull();
    expect(row.slug).toMatch(/^selling-in-spring-/);
  });

  it("never reuses a slug, so an old link cannot open a different article", async () => {
    const title = `Duplicate headline ${Date.now() % 100000}`;
    const a = await createBlogPost({ title });
    const b = await createBlogPost({ title });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(b.data.slug).not.toBe(a.data.slug);
      expect(b.data.slug).toBe(`${a.data.slug}-2`);
    }
  });

  it("refuses a title that cannot become a web address", async () => {
    const r = await createBlogPost({ title: "!!! ??? ***" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/no letters or numbers/i);
  });

  it("creates a social post as a draft", async () => {
    const body = `Open this Saturday ${Date.now() % 100000}`;
    const r = await createSocialPost({ network: "instagram", body, listingId });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [row] = await sql<{ status: string; published_at: Date | null }[]>`
      select status, published_at from social_posts where id = ${r.data.id}`;
    expect(row.status).toBe("draft");
    expect(row.published_at).toBeNull();
  });
});

describe("new proposal", () => {
  it("creates a draft with an estimate range", async () => {
    const r = await createProposal({ contactId, estimateLow: 750000, estimateHigh: 800000 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [row] = await sql<
      { status: string; estimate_low: number; estimate_high: number; pdf_s3_key: string | null;
        comparables: number | null }[]
    >`select status, estimate_low, estimate_high, pdf_s3_key, comparables
      from proposals where id = ${r.data.id}`;
    expect(row.status).toBe("draft");
    expect(row.estimate_low).toBe(750000);
    // Nothing has been generated, so nothing claims to have been.
    expect(row.pdf_s3_key).toBeNull();
    expect(row.comparables).toBeNull();
  });

  it("refuses half a range", async () => {
    const r = await createProposal({ contactId, estimateLow: 750000 });
    expect(r.ok).toBe(false);
    // A single figure on an appraisal is the shape under-quoting rules exist to catch.
    if (!r.ok) expect(r.error).toMatch(/both a low and a high/i);
  });

  it("refuses half a range submitted from a BROWSER, where the blank field is an empty string", async () => {
    /**
     * The shape a real form produces, and the one a hand-written undefined hides.
     * z.coerce.number() turns "" into 0, which silently made the missing half a
     * valid figure — the live check caught this saying "the low estimate is above
     * the high one" about a field nobody had filled in.
     */
    const r = await createProposal({
      contactId,
      estimateLow: 750000,
      estimateHigh: "" as unknown as number,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/both a low and a high/i);
  });

  it("stores nothing at all when both figures are left blank in a browser", async () => {
    const r = await createProposal({
      contactId,
      estimateLow: "" as unknown as number,
      estimateHigh: "" as unknown as number,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [row] = await sql<{ estimate_low: number | null; estimate_high: number | null }[]>`
      select estimate_low, estimate_high from proposals where id = ${r.data.id}`;
    // Not 0. "$0 - $0" on a vendor proposal is a claim; null is "not appraised yet".
    expect(row.estimate_low).toBeNull();
    expect(row.estimate_high).toBeNull();
  });

  it("accepts no estimate at all", async () => {
    expect((await createProposal({ contactId })).ok).toBe(true);
  });

  it("refuses an inverted range", async () => {
    const r = await createProposal({ contactId, estimateLow: 900000, estimateHigh: 700000 });
    expect(r.ok).toBe(false);
  });

  it("refuses a proposal to someone who asked to be removed", async () => {
    const [gone] = await sql<{ id: string }[]>`
      insert into contacts (tenant_id, first_name, last_name, source_channel, tombstoned_at)
      values (${tenantId}, 'Gone', ${`Vendor${Date.now() % 100000}`}, 'manual', now())
      returning id`;
    const r = await createProposal({ contactId: gone.id });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/asked to be removed/i);
  });
});

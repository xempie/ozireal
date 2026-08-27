import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import postgres from "postgres";
import { systemTenantId } from "@/db";

/**
 * The "New …" write paths.
 *
 * Each of these forms can submit something the database would reject. The point
 * of the tests is that the REFUSAL is a sentence about the problem, not a
 * constraint name in a 500 — and that the guards which have no database backing
 * (a duplicate address, a second live campaign) actually hold.
 */

vi.mock("@/server/jobs/queues", () => ({ enqueue: async () => true }));

const h = vi.hoisted(() => ({
  session: {
    user: {
      id: "",
      name: "Sam Whitfield",
      email: "sam@ozirealty.com.au",
      tenantId: "",
      role: "principal",
    },
  } as { user: Record<string, string> } | null,
}));
vi.mock("@/auth", () => ({ auth: async () => h.session }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

const { createProperty, createListing } = await import("@/server/actions/stock");
const { createTask, completeTask, createCalendarEvent } = await import(
  "@/server/actions/ops"
);

let sql: postgres.Sql;
let tenantId: string;
let suburbId: string;
let seq = 0;

beforeAll(async () => {
  sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  tenantId = await systemTenantId();
  const [u] = await sql<{ id: string }[]>`select id from users limit 1`;
  h.session!.user.tenantId = tenantId;
  h.session!.user.id = u.id;
  const [s] = await sql<{ id: string }[]>`select id from suburbs limit 1`;
  suburbId = s.id;
});
afterAll(async () => {
  await sql?.end();
});

function street() {
  seq += 1;
  return `Testcase ${seq} Street ${Date.now() % 100000}`;
}

describe("new property", () => {
  it("creates one, taking state and postcode from the suburb", async () => {
    const st = street();
    const r = await createProperty({
      streetNumber: "12",
      street: st,
      suburbId,
      propertyType: "house",
      status: "prospect",
      beds: 3,
      baths: 2,
    });
    expect(r.ok).toBe(true);

    const [row] = await sql<
      { state: string; postcode: string; status: string; beds: number }[]
    >`select p.state, p.postcode, p.status, p.beds from properties p where p.street = ${st}`;
    const [sub] = await sql<{ state: string; postcode: string }[]>`
      select state, postcode from suburbs where id = ${suburbId}`;
    // Never the literal 'SA' — §10 forbids hardcoding one state's rules.
    expect(row.state).toBe(sub.state);
    expect(row.postcode).toBe(sub.postcode);
    expect(row.status).toBe("prospect");
  });

  it("REFUSES a duplicate address, because a property cannot be merged later", async () => {
    const st = street();
    const first = await createProperty({
      streetNumber: "5", street: st, suburbId, propertyType: "house", status: "prospect",
    });
    expect(first.ok).toBe(true);

    const second = await createProperty({
      streetNumber: "5", street: st, suburbId, propertyType: "house", status: "prospect",
    });
    // The opposite of the contact rule, and deliberately: two rows for one house
    // permanently split the listing history.
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toMatch(/already in your stock/i);
  });

  it("treats a unit number as part of the address, so flats are separate properties", async () => {
    const st = street();
    const a = await createProperty({
      unit: "1", streetNumber: "7", street: st, suburbId, propertyType: "unit", status: "prospect",
    });
    const b = await createProperty({
      unit: "2", streetNumber: "7", street: st, suburbId, propertyType: "unit", status: "prospect",
    });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
  });

  it("refuses bedrooms on land", async () => {
    const r = await createProperty({
      streetNumber: "9", street: street(), suburbId, propertyType: "land", status: "prospect", beds: 3,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/land has no bedrooms/i);
  });

  it("records a blank bedroom count as unknown, not as zero bedrooms", async () => {
    // What a browser actually submits for an untouched number input.
    const st = street();
    const r = await createProperty({
      streetNumber: "15",
      street: st,
      suburbId,
      propertyType: "house",
      status: "prospect",
      beds: "" as unknown as number,
      baths: "" as unknown as number,
    });
    expect(r.ok).toBe(true);
    const [row] = await sql<{ beds: number | null; baths: number | null }[]>`
      select beds, baths from properties where street = ${st}`;
    // "0 beds" is a claim about the house; null is an absence of one.
    expect(row.beds).toBeNull();
    expect(row.baths).toBeNull();
  });

  it("gives a field error for a fractional bedroom count, not a database error", async () => {
    const r = await createProperty({
      streetNumber: "11", street: street(), suburbId, propertyType: "house", status: "prospect", beds: 3.5,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors?.beds?.[0]).toMatch(/whole numbers/i);
  });

  it("will not offer a status that belongs to a campaign", async () => {
    const r = await createProperty({
      streetNumber: "13", street: street(), suburbId, propertyType: "house", status: "listed",
    });
    // "listed" is a fact about a listing; a property claiming it with none is a lie.
    expect(r.ok).toBe(false);
  });
});

describe("new listing", () => {
  async function aProperty() {
    const st = street();
    const r = await createProperty({
      streetNumber: "21", street: st, suburbId, propertyType: "house", status: "prospect",
    });
    if (!r.ok) throw new Error(r.error);
    return r.data.id;
  }

  it("creates a DRAFT and marks the property listed", async () => {
    const propertyId = await aProperty();
    const r = await createListing({
      propertyId,
      listingType: "sale",
      priceDisplay: "Offers above $750,000",
      searchPriceMin: 750000,
      searchPriceMax: 800000,
    });
    expect(r.ok).toBe(true);

    const [l] = await sql<{ status: string; slug: string }[]>`
      select status, slug from listings where property_id = ${propertyId}`;
    // Publishing is a separate, deliberate act.
    expect(l.status).toBe("draft");
    expect(l.slug).toMatch(/testcase/);

    const [p] = await sql<{ status: string }[]>`
      select status from properties where id = ${propertyId}`;
    expect(p.status).toBe("listed");
  });

  it("refuses a second live campaign on one property", async () => {
    const propertyId = await aProperty();
    const first = await createListing({ propertyId, listingType: "sale", priceDisplay: "Contact agent" });
    expect(first.ok).toBe(true);
    if (first.ok) {
      await sql`update listings set status = 'live' where id = ${first.data.id}`;
    }
    const second = await createListing({ propertyId, listingType: "sale", priceDisplay: "Contact agent" });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error).toMatch(/already has a live campaign/i);
  });

  it("gives every listing a unique slug, so an old link never lands on another property", async () => {
    const a = await createListing({ propertyId: await aProperty(), listingType: "sale", priceDisplay: "x" });
    const b = await createListing({ propertyId: await aProperty(), listingType: "sale", priceDisplay: "x" });
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) expect(a.data.slug).not.toBe(b.data.slug);
  });

  it("refuses an inverted search price range", async () => {
    const r = await createListing({
      propertyId: await aProperty(),
      listingType: "sale",
      priceDisplay: "x",
      searchPriceMin: 900000,
      searchPriceMax: 700000,
    });
    expect(r.ok).toBe(false);
  });
});

describe("new task", () => {
  it("creates one, labelled as hand-written", async () => {
    const r = await createTask({ title: "Ring the conveyancer about Powell St", dueInDays: 3 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const [t] = await sql<{ source_label: string; due_at: Date; status: string }[]>`
        select source_label, due_at, status from tasks where id = ${r.data.id}`;
      // The only difference that should survive between a hand-written task and
      // one committed off an AI proposal.
      expect(t.source_label).toMatch(/by hand/i);
      expect(t.status).toBe("open");
      expect(t.due_at).not.toBeNull();
    }
  });

  it("refuses a task against a contact who asked to be removed", async () => {
    const [c] = await sql<{ id: string }[]>`
      insert into contacts (tenant_id, first_name, last_name, source_channel, tombstoned_at)
      values (${tenantId}, 'Gone', ${`Away${Date.now() % 100000}`}, 'manual', now())
      returning id`;
    const r = await createTask({ title: "Chase this up", contactId: c.id });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/asked to be removed/i);
  });

  it("completes a task once, and refuses the second time", async () => {
    const r = await createTask({ title: "Something to finish" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect((await completeTask({ id: r.data.id })).ok).toBe(true);
    expect((await completeTask({ id: r.data.id })).ok).toBe(false);
  });
});

describe("new calendar event", () => {
  it("creates one marked as ours, so a future sync knows what it may touch", async () => {
    const r = await createCalendarEvent({
      title: "Open inspection — Powell St",
      kind: "inspection",
      startsAt: new Date(Date.now() + 86_400_000).toISOString(),
      durationMinutes: 30,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const [e] = await sql<
        { provider: string; our_write: boolean; ends_at: Date; starts_at: Date }[]
      >`select provider, our_write, ends_at, starts_at from calendar_events where id = ${r.data.id}`;
      // D5: the external calendar owns anything it created; we never edit those.
      expect(e.provider).toBe("ozirealty");
      expect(e.our_write).toBe(true);
      expect(e.ends_at.getTime() - e.starts_at.getTime()).toBe(30 * 60_000);
    }
  });

  it("refuses a start time it cannot read", async () => {
    const r = await createCalendarEvent({
      title: "Nonsense time",
      kind: "meeting",
      startsAt: "not a date",
      durationMinutes: 30,
    });
    expect(r.ok).toBe(false);
  });
});

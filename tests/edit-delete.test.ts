import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import postgres from "postgres";
import { systemTenantId } from "@/db";

/**
 * The edit and delete paths.
 *
 * Creating a record is the easy half. What these test is the half that decides
 * whether the console is safe to hand to somebody: every one of these actions can
 * destroy or rewrite something that is evidence, and almost all of them are meant to
 * REFUSE rather than succeed.
 *
 * So the assertions are mostly negative, and they check the row afterwards rather
 * than trusting the return value. A delete that reports failure and deletes anyway
 * is exactly the bug this file exists to catch.
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

const {
  createProperty,
  updateProperty,
  deleteProperty,
  createListing,
  updateListing,
  setListingStatus,
  deleteListing,
  createInspection,
  cancelInspection,
} = await import("@/server/actions/stock");
const {
  createTask,
  completeTask,
  updateTask,
  reopenTask,
  deleteTask,
  createCalendarEvent,
  updateCalendarEvent,
  cancelCalendarEvent,
  createRedirect,
  updateRedirect,
  deleteRedirect,
} = await import("@/server/actions/ops");
const {
  createBlogPost,
  updateBlogPost,
  setBlogPostStatus,
  deleteBlogPost,
} = await import("@/server/actions/content");
const { createCampaign, deleteCampaign } = await import("@/server/actions/campaigns");
const { createProposal, updateProposal, deleteProposal } = await import(
  "@/server/actions/proposals"
);

let sql: postgres.Sql;
let tenantId: string;
let suburbId: string;
let userId: string;
let seq = 0;

beforeAll(async () => {
  sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  tenantId = await systemTenantId();
  const [u] = await sql<{ id: string }[]>`select id from users limit 1`;
  userId = u.id;
  h.session!.user.tenantId = tenantId;
  h.session!.user.id = userId;
  const [s] = await sql<{ id: string }[]>`select id from suburbs limit 1`;
  suburbId = s.id;
});
afterAll(async () => {
  await sql?.end();
});

function unwrap<T>(r: { ok: true; data: T } | { ok: false; error: string }): T {
  if (!r.ok) throw new Error(`action failed: ${r.error}`);
  return r.data;
}

function street() {
  seq += 1;
  return `Edit case ${seq} Street ${Date.now() % 1000000}`;
}

/** A property with nothing attached to it, so a delete is genuinely allowed. */
async function freshProperty(overrides: Record<string, unknown> = {}) {
  return unwrap(
    await createProperty({
      streetNumber: "1",
      street: street(),
      suburbId,
      propertyType: "house",
      status: "prospect",
      beds: 3,
      baths: 1,
      ...overrides,
    }),
  ) as { id: string; address: string };
}

async function freshListing(propertyId: string, overrides: Record<string, unknown> = {}) {
  return unwrap(
    await createListing({
      propertyId,
      listingType: "sale",
      priceDisplay: "Offers above $700,000",
      publicHeadline: "A house",
      publicCopy: "Original copy.",
      ...overrides,
    }),
  ) as { id: string; slug: string };
}

/* --------------------------------------------------------------- property */

describe("editing a property", () => {
  it("saves without refusing against its own address", async () => {
    const p = await freshProperty();
    const [before] = await sql<
      { street: string; suburb_id: string }[]
    >`select street, suburb_id from properties where id = ${p.id}`;

    // Nothing about the address changed. The duplicate check must exclude this row.
    const r = await updateProperty({
      id: p.id,
      streetNumber: "1",
      street: before.street,
      suburbId: before.suburb_id,
      propertyType: "house",
      status: "appraised",
      beds: 4,
      baths: 1,
    });
    expect(r.ok).toBe(true);

    const [after] = await sql<
      { beds: number; status: string }[]
    >`select beds, status from properties where id = ${p.id}`;
    expect(after.beds).toBe(4);
    expect(after.status).toBe("appraised");
  });

  it("refuses to take another property's address", async () => {
    const a = await freshProperty();
    const b = await freshProperty();
    const [aRow] = await sql<{ street: string }[]>`
      select street from properties where id = ${a.id}`;

    const r = await updateProperty({
      id: b.id,
      streetNumber: "1",
      street: aRow.street,
      suburbId,
      propertyType: "house",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/already has that address/i);
  });

  it("refuses a status change while a campaign owns the status", async () => {
    const p = await freshProperty();
    await freshListing(p.id);
    // createListing flips the property to "listed".
    const [row] = await sql<{ status: string }[]>`
      select status from properties where id = ${p.id}`;
    expect(row.status).toBe("listed");

    const r = await updateProperty({
      id: p.id,
      streetNumber: "1",
      street: (
        await sql<{ street: string }[]>`select street from properties where id = ${p.id}`
      )[0].street,
      suburbId,
      propertyType: "house",
      status: "off_market",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/set by its campaign/i);
  });

  it("still saves the other fields on a listed property when status is omitted", async () => {
    const p = await freshProperty();
    await freshListing(p.id);
    const [row] = await sql<{ street: string }[]>`
      select street from properties where id = ${p.id}`;

    const r = await updateProperty({
      id: p.id,
      streetNumber: "1",
      street: row.street,
      suburbId,
      propertyType: "house",
      beds: 5,
    });
    expect(r.ok).toBe(true);
    const [after] = await sql<{ beds: number; status: string }[]>`
      select beds, status from properties where id = ${p.id}`;
    expect(after.beds).toBe(5);
    expect(after.status).toBe("listed");
  });
});

describe("deleting a property", () => {
  it("deletes one that was never listed", async () => {
    const p = await freshProperty();
    expect(unwrap(await deleteProperty({ id: p.id }))).toEqual({ deleted: true });
    const rows = await sql`select 1 from properties where id = ${p.id}`;
    expect(rows.length).toBe(0);
  });

  it("refuses once a listing exists, and the row survives", async () => {
    const p = await freshProperty();
    await freshListing(p.id);

    const r = await deleteProperty({ id: p.id });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/sold archive|cannot be deleted/i);

    // The important half: refused AND still there.
    const rows = await sql`select 1 from properties where id = ${p.id}`;
    expect(rows.length).toBe(1);
  });

  it("writes the audit row before the delete, so it is not orphaned", async () => {
    const p = await freshProperty();
    await deleteProperty({ id: p.id });
    const [a] = await sql<{ action: string }[]>`
      select action from audit_log
      where entity_type = 'property' and entity_id = ${p.id}
      order by occurred_at desc limit 1`;
    expect(a.action).toMatch(/Deleted a property/);
  });
});

/* ---------------------------------------------------------------- listing */

describe("listing status", () => {
  it("publishing moves the property to listed and sets published_at once", async () => {
    const p = await freshProperty();
    const l = await freshListing(p.id);

    expect(unwrap(await setListingStatus({ id: l.id, status: "live" }))).toEqual({
      status: "live",
    });
    const [first] = await sql<{ published_at: Date }[]>`
      select published_at from listings where id = ${l.id}`;
    expect(first.published_at).not.toBeNull();

    unwrap(await setListingStatus({ id: l.id, status: "withdrawn" }));
    unwrap(await setListingStatus({ id: l.id, status: "live" }));
    const [again] = await sql<{ published_at: Date }[]>`
      select published_at from listings where id = ${l.id}`;
    // Republishing keeps the ORIGINAL date - that is when the market first saw it.
    expect(again.published_at.getTime()).toBe(first.published_at.getTime());
  });

  it("refuses to publish without price wording", async () => {
    const p = await freshProperty();
    const l = await freshListing(p.id, { priceDisplay: "" });

    const r = await setListingStatus({ id: l.id, status: "live" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/price wording/i);
    const [row] = await sql<{ status: string }[]>`
      select status from listings where id = ${l.id}`;
    expect(row.status).toBe("draft");
  });

  it("refuses a second live campaign on the same property", async () => {
    const p = await freshProperty();
    const a = await freshListing(p.id);
    unwrap(await setListingStatus({ id: a.id, status: "live" }));

    // A second draft cannot even be created while one is live, so withdraw,
    // create, then republish the first to set up the clash.
    unwrap(await setListingStatus({ id: a.id, status: "withdrawn" }));
    const b = await freshListing(p.id);
    unwrap(await setListingStatus({ id: a.id, status: "live" }));

    const r = await setListingStatus({ id: b.id, status: "live" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/already has a live campaign/i);
  });

  it("refuses to mark a sale campaign leased", async () => {
    const p = await freshProperty();
    const l = await freshListing(p.id);
    unwrap(await setListingStatus({ id: l.id, status: "live" }));

    const r = await setListingStatus({ id: l.id, status: "leased" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/sale campaign/i);
  });

  it("freezes a settled campaign", async () => {
    const p = await freshProperty();
    const l = await freshListing(p.id);
    unwrap(await setListingStatus({ id: l.id, status: "live" }));
    unwrap(await setListingStatus({ id: l.id, status: "sold" }));

    const [prop] = await sql<{ status: string }[]>`
      select status from properties where id = ${p.id}`;
    expect(prop.status).toBe("sold");

    const r = await setListingStatus({ id: l.id, status: "withdrawn" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/settled/i);
  });

  it("withdrawing returns the property to off_market, not prospect", async () => {
    const p = await freshProperty();
    const l = await freshListing(p.id);
    unwrap(await setListingStatus({ id: l.id, status: "live" }));
    unwrap(await setListingStatus({ id: l.id, status: "withdrawn" }));

    const [prop] = await sql<{ status: string }[]>`
      select status from properties where id = ${p.id}`;
    expect(prop.status).toBe("off_market");
  });
});

describe("editing a listing", () => {
  it("never moves the slug when the copy changes", async () => {
    const p = await freshProperty();
    const l = await freshListing(p.id);

    unwrap(
      await updateListing({
        id: l.id,
        listingType: "sale",
        priceDisplay: "Contact agent",
        publicHeadline: "A completely different headline",
        publicCopy: "Completely rewritten.",
      }),
    );
    const [row] = await sql<{ slug: string; public_copy: string }[]>`
      select slug, public_copy from listings where id = ${l.id}`;
    expect(row.slug).toBe(l.slug);
    expect(row.public_copy).toBe("Completely rewritten.");
  });

  it("re-embeds only when the embedded text changed", async () => {
    const p = await freshProperty();
    const l = await freshListing(p.id);

    const priceOnly = unwrap(
      await updateListing({
        id: l.id,
        listingType: "sale",
        priceDisplay: "Offers above $710,000",
        publicHeadline: "A house",
        publicCopy: "Original copy.",
      }),
    ) as { reembedding: boolean };
    expect(priceOnly.reembedding).toBe(false);

    const copyChanged = unwrap(
      await updateListing({
        id: l.id,
        listingType: "sale",
        priceDisplay: "Offers above $710,000",
        publicHeadline: "A house",
        publicCopy: "New copy entirely.",
      }),
    ) as { reembedding: boolean };
    expect(copyChanged.reembedding).toBe(true);
  });

  it("refuses to clear the price wording on a live listing", async () => {
    const p = await freshProperty();
    const l = await freshListing(p.id);
    unwrap(await setListingStatus({ id: l.id, status: "live" }));

    const r = await updateListing({
      id: l.id,
      listingType: "sale",
      priceDisplay: "",
      publicCopy: "Still here.",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/price wording/i);
  });

  it("refuses to switch sale to rent once live", async () => {
    const p = await freshProperty();
    const l = await freshListing(p.id);
    unwrap(await setListingStatus({ id: l.id, status: "live" }));

    const r = await updateListing({
      id: l.id,
      listingType: "rent",
      priceDisplay: "$650 per week",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/sale and rent/i);
  });
});

describe("deleting a listing", () => {
  it("deletes a draft and puts the property back to off_market", async () => {
    const p = await freshProperty();
    const l = await freshListing(p.id);
    expect(unwrap(await deleteListing({ id: l.id }))).toEqual({ deleted: true });

    const rows = await sql`select 1 from listings where id = ${l.id}`;
    expect(rows.length).toBe(0);
    const [prop] = await sql<{ status: string }[]>`
      select status from properties where id = ${p.id}`;
    // createListing had set it to "listed"; that claim is now false.
    expect(prop.status).toBe("off_market");
  });

  it("refuses anything that has been advertised", async () => {
    const p = await freshProperty();
    const l = await freshListing(p.id);
    unwrap(await setListingStatus({ id: l.id, status: "live" }));
    unwrap(await setListingStatus({ id: l.id, status: "withdrawn" }));

    const r = await deleteListing({ id: l.id });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/only a draft/i);
    const rows = await sql`select 1 from listings where id = ${l.id}`;
    expect(rows.length).toBe(1);
  });
});

/* ------------------------------------------------------------- inspections */

describe("inspections", () => {
  it("schedules one and cancels it without deleting the row", async () => {
    const p = await freshProperty();
    const l = await freshListing(p.id);
    const i = unwrap(
      await createInspection({
        listingId: l.id,
        startsAt: new Date(Date.now() + 86_400_000).toISOString(),
        minutes: 30,
        kind: "open",
      }),
    ) as { id: string };

    unwrap(await cancelInspection({ id: i.id }));
    const [row] = await sql<{ cancelled: boolean }[]>`
      select cancelled from inspections where id = ${i.id}`;
    // A registration must never point at nothing.
    expect(row.cancelled).toBe(true);
  });

  it("refuses an inspection on a settled campaign", async () => {
    const p = await freshProperty();
    const l = await freshListing(p.id);
    unwrap(await setListingStatus({ id: l.id, status: "live" }));
    unwrap(await setListingStatus({ id: l.id, status: "sold" }));

    const r = await createInspection({
      listingId: l.id,
      startsAt: new Date(Date.now() + 86_400_000).toISOString(),
      minutes: 30,
      kind: "open",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/closed/i);
  });
});

/* ------------------------------------------------------------------ tasks */

describe("tasks", () => {
  it("edits an open task and can clear its due date", async () => {
    const t = unwrap(
      await createTask({ title: "Ring the conveyancer", dueInDays: 3 }),
    ) as { id: string };

    unwrap(await updateTask({ id: t.id, title: "Ring the conveyancer twice", dueAt: "" }));
    const [row] = await sql<{ title: string; due_at: Date | null }[]>`
      select title, due_at from tasks where id = ${t.id}`;
    expect(row.title).toBe("Ring the conveyancer twice");
    // Blank means absent, not today.
    expect(row.due_at).toBeNull();
  });

  it("refuses to edit a completed task, and reopening allows it again", async () => {
    const t = unwrap(await createTask({ title: "Send the contract" })) as { id: string };
    unwrap(await completeTask({ id: t.id }));

    const refused = await updateTask({ id: t.id, title: "Send the other contract" });
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error).toMatch(/already done/i);

    unwrap(await reopenTask({ id: t.id }));
    const [row] = await sql<{ status: string; completed_at: Date | null }[]>`
      select status, completed_at from tasks where id = ${t.id}`;
    expect(row.status).toBe("open");
    expect(row.completed_at).toBeNull();

    expect((await updateTask({ id: t.id, title: "Send the other contract" })).ok).toBe(true);
  });

  it("deletes, and the audit row survives the row it describes", async () => {
    const t = unwrap(await createTask({ title: "Throwaway task" })) as { id: string };
    unwrap(await deleteTask({ id: t.id }));

    expect((await sql`select 1 from tasks where id = ${t.id}`).length).toBe(0);
    const [a] = await sql<{ action: string }[]>`
      select action from audit_log
      where entity_type = 'task' and entity_id = ${t.id}
      order by occurred_at desc limit 1`;
    expect(a.action).toMatch(/Deleted a task/);
  });
});

/* --------------------------------------------------------------- calendar */

describe("calendar events", () => {
  it("edits and cancels one we created", async () => {
    const e = unwrap(
      await createCalendarEvent({
        title: "Appraisal at Powell St",
        kind: "appraisal",
        startsAt: new Date(Date.now() + 3_600_000).toISOString(),
        durationMinutes: 30,
      }),
    ) as { id: string };

    unwrap(
      await updateCalendarEvent({
        id: e.id,
        title: "Appraisal, rescheduled",
        kind: "appraisal",
        startsAt: new Date(Date.now() + 7_200_000).toISOString(),
        durationMinutes: 45,
      }),
    );
    const [row] = await sql<{ title: string; starts_at: Date; ends_at: Date }[]>`
      select title, starts_at, ends_at from calendar_events where id = ${e.id}`;
    expect(row.title).toBe("Appraisal, rescheduled");
    expect((row.ends_at.getTime() - row.starts_at.getTime()) / 60000).toBe(45);

    unwrap(await cancelCalendarEvent({ id: e.id }));
    const [after] = await sql<{ cancelled_at: Date | null }[]>`
      select cancelled_at from calendar_events where id = ${e.id}`;
    // Flagged, not deleted - the sync needs something to push.
    expect(after.cancelled_at).not.toBeNull();
  });

  it("refuses to touch an event the external calendar owns", async () => {
    const [row] = await sql<{ id: string }[]>`
      insert into calendar_events
        (tenant_id, user_id, provider, external_id, our_write, title, starts_at, kind)
      values (${tenantId}, ${userId}, 'google', ${"ext-" + Date.now()}, false,
              'Dentist', now() + interval '1 day', 'personal')
      returning id`;

    const edit = await updateCalendarEvent({
      id: row.id,
      title: "Not the dentist",
      kind: "personal",
      startsAt: new Date(Date.now() + 86_400_000).toISOString(),
      durationMinutes: 30,
    });
    expect(edit.ok).toBe(false);
    if (!edit.ok) expect(edit.error).toMatch(/Google calendar/i);

    const cancel = await cancelCalendarEvent({ id: row.id });
    expect(cancel.ok).toBe(false);

    const [after] = await sql<{ title: string; cancelled_at: Date | null }[]>`
      select title, cancelled_at from calendar_events where id = ${row.id}`;
    expect(after.title).toBe("Dentist");
    expect(after.cancelled_at).toBeNull();
  });
});

/* ---------------------------------------------------------------- content */

describe("articles", () => {
  it("keeps the slug when the title changes, and recounts the words", async () => {
    const created = unwrap(
      await createBlogPost({ title: `Spring in Norwood ${Date.now()}`, body: "one two three" }),
    ) as { id: string; slug: string };

    unwrap(
      await updateBlogPost({
        id: created.id,
        title: "Something else entirely",
        body: "one two three four five",
      }),
    );
    const [row] = await sql<{ slug: string; word_count: number; title: string }[]>`
      select slug, word_count, title from blog_posts where id = ${created.id}`;
    expect(row.slug).toBe(created.slug);
    expect(row.title).toBe("Something else entirely");
    expect(row.word_count).toBe(5);
  });

  it("has no route to published — only into the approval queue", async () => {
    const created = unwrap(
      await createBlogPost({ title: `Approval path ${Date.now()}`, body: "a body" }),
    ) as { id: string };

    unwrap(await setBlogPostStatus({ id: created.id, status: "in_approval" }));
    const [row] = await sql<{ status: string }[]>`
      select status from blog_posts where id = ${created.id}`;
    expect(row.status).toBe("in_approval");

    // The action's own schema forbids it - rule 1 has no config flag.
    const r = await setBlogPostStatus({ id: created.id, status: "published" });
    expect(r.ok).toBe(false);
  });

  it("refuses to send an empty article for approval", async () => {
    const created = unwrap(
      await createBlogPost({ title: `Empty one ${Date.now()}` }),
    ) as { id: string };
    const r = await setBlogPostStatus({ id: created.id, status: "in_approval" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/nothing to approve/i);
  });

  it("refuses to delete a published article", async () => {
    const created = unwrap(
      await createBlogPost({ title: `Published one ${Date.now()}`, body: "words here" }),
    ) as { id: string };
    await sql`update blog_posts set status = 'published' where id = ${created.id}`;

    const r = await deleteBlogPost({ id: created.id });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/archive it instead/i);
    expect((await sql`select 1 from blog_posts where id = ${created.id}`).length).toBe(1);
  });
});

/* -------------------------------------------------------------- campaigns */

describe("campaigns", () => {
  it("deletes a draft that has reached nobody", async () => {
    const c = unwrap(
      await createCampaign({ name: `Deletable ${Date.now()}`, channel: "email" }),
    ) as { id: string };
    expect(unwrap(await deleteCampaign({ id: c.id }))).toEqual({ deleted: true });
  });

  it("refuses to delete one where a send was blocked", async () => {
    const c = unwrap(
      await createCampaign({ name: `Blocked ${Date.now()}`, channel: "email" }),
    ) as { id: string };
    const [contact] = await sql<{ id: string }[]>`
      select id from contacts where tombstoned_at is null limit 1`;
    await sql`
      insert into campaign_recipients (tenant_id, campaign_id, contact_id, blocked_reason)
      values (${tenantId}, ${c.id}, ${contact.id}, 'consent lapsed')`;

    const r = await deleteCampaign({ id: c.id });
    expect(r.ok).toBe(false);
    // A block is the MORE valuable record of the two - it is what you produce if a
    // send is ever challenged.
    if (!r.ok) expect(r.error).toMatch(/evidence/i);
    expect((await sql`select 1 from campaigns where id = ${c.id}`).length).toBe(1);
  });
});

/* -------------------------------------------------------------- proposals */

describe("proposals", () => {
  it("refuses half a range on edit, just as on create", async () => {
    const [contact] = await sql<{ id: string }[]>`
      select id from contacts where tombstoned_at is null and merged_into_id is null limit 1`;
    const p = unwrap(
      await createProposal({ contactId: contact.id, estimateLow: 700000, estimateHigh: 760000 }),
    ) as { id: string };

    const r = await updateProposal({ id: p.id, estimateLow: 700000 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/both a low and a high/i);

    const [row] = await sql<{ estimate_high: number }[]>`
      select estimate_high from proposals where id = ${p.id}`;
    expect(row.estimate_high).toBe(760000);
  });

  it("refuses to edit or delete one that has been sent", async () => {
    const [contact] = await sql<{ id: string }[]>`
      select id from contacts where tombstoned_at is null and merged_into_id is null limit 1`;
    const p = unwrap(
      await createProposal({ contactId: contact.id, estimateLow: 700000, estimateHigh: 760000 }),
    ) as { id: string };
    await sql`update proposals set status = 'sent' where id = ${p.id}`;

    expect((await updateProposal({ id: p.id, estimateLow: 1, estimateHigh: 2 })).ok).toBe(false);
    expect((await deleteProposal({ id: p.id })).ok).toBe(false);
    const [row] = await sql<{ estimate_low: number }[]>`
      select estimate_low from proposals where id = ${p.id}`;
    expect(row.estimate_low).toBe(700000);
  });
});

/* ----------------------------------------------------------- redirect map */

describe("the redirect map", () => {
  it("normalises paths and refuses a duplicate", async () => {
    const path = `/legacy-${Date.now()}`;
    unwrap(await createRedirect({ fromPath: path.slice(1) + "/", toPath: "/new-home" }));

    const [row] = await sql<{ from_path: string; to_path: string }[]>`
      select from_path, to_path from redirects where from_path = ${path}`;
    // A leading slash added, a trailing one removed - otherwise one page becomes
    // two keys and the map silently grows duplicates.
    expect(row.from_path).toBe(path);
    expect(row.to_path).toBe("/new-home");

    const dup = await createRedirect({ fromPath: path, toPath: "/somewhere-else" });
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.error).toMatch(/already in the map/i);
  });

  it("refuses a mapped row with no destination, and refuses a self-loop", async () => {
    const path = `/undecided-${Date.now()}`;
    const noTarget = await createRedirect({ fromPath: path, status: "mapped" });
    expect(noTarget.ok).toBe(false);
    if (!noTarget.ok) expect(noTarget.error).toMatch(/needs a destination/i);

    const loop = await createRedirect({ fromPath: path, toPath: path, status: "mapped" });
    expect(loop.ok).toBe(false);
    if (!loop.ok) expect(loop.error).toMatch(/itself/i);
  });

  it("edits and removes a row", async () => {
    const path = `/editable-${Date.now()}`;
    const r = unwrap(await createRedirect({ fromPath: path })) as { id: string };

    unwrap(
      await updateRedirect({
        id: r.id,
        fromPath: path,
        toPath: "/services/overseas-investment",
        status: "mapped",
        note: "misspelling on the old site",
      }),
    );
    const [row] = await sql<{ status: string; note: string }[]>`
      select status, note from redirects where id = ${r.id}`;
    expect(row.status).toBe("mapped");
    expect(row.note).toBe("misspelling on the old site");

    unwrap(await deleteRedirect({ id: r.id }));
    expect((await sql`select 1 from redirects where id = ${r.id}`).length).toBe(0);
  });
});

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import postgres from "postgres";

/**
 * The write paths.
 *
 * B1 proved the schema refuses bad data. This proves the ACTIONS behave correctly when
 * the data is fine but the situation is awkward: a duplicate arrives, a proposal is
 * committed twice, someone tries to un-delete a record. Those are the cases where an
 * action quietly does the wrong thing and nobody notices for months, because nothing
 * errors — it just writes something that was never true.
 *
 * Everything runs against the real database through the real defineAction wrapper, so
 * the audit row, the transaction and the tenant scoping are exercised too rather than
 * being assumed.
 */

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

// The actions call auth() for the session and revalidatePath() for the router cache.
// Neither exists outside a request, and neither is what these tests are about.
vi.mock("@/auth", () => ({ auth: async () => h.session }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

const {
  createContact,
  logInteraction,
  recordFollowupOutcome,
  tombstoneContact,
  commitConfirmItem,
  discardConfirmItem,
  resolveMergeReview,
} = await import("@/server/actions/contacts");

let sql: postgres.Sql;

beforeAll(async () => {
  sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  const [t] = await sql<{ id: string }[]>`select id from tenants limit 1`;
  const [u] = await sql<{ id: string }[]>`select id from users limit 1`;
  h.session!.user.tenantId = t.id;
  h.session!.user.id = u.id;
});

afterAll(async () => {
  await sql?.end();
});

/** Narrows the result union, and fails with the server's message rather than "undefined". */
function unwrap<T>(r: { ok: true; data: T } | { ok: false; error: string }): T {
  if (!r.ok) throw new Error(`action failed: ${r.error}`);
  return r.data;
}

let created = 0;
function unique(prefix: string) {
  created += 1;
  return `${prefix}${created}`;
}

describe("every action refuses without a session", () => {
  it("returns a signed-out result rather than throwing or writing", async () => {
    const saved = h.session;
    h.session = null;
    try {
      const before = await sql`select count(*)::int as n from contacts`;
      const r = await createContact({
        firstName: "Nobody",
        lastName: "Atall",
        email: "",
        phone: "",
        roles: ["buyer"],
      });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/signed out/i);
      const after = await sql`select count(*)::int as n from contacts`;
      expect(after[0].n).toBe(before[0].n);
    } finally {
      h.session = saved;
    }
  });
});

describe("validation happens on the server, not just in the browser", () => {
  it("rejects a blank name with a field error naming the field", async () => {
    const r = await createContact({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      roles: ["buyer"],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.fieldErrors?.firstName?.[0]).toMatch(/required/i);
      expect(r.fieldErrors?.lastName?.[0]).toMatch(/required/i);
    }
  });

  it("rejects a contact with no role at all", async () => {
    const r = await createContact({
      firstName: "Roleless",
      lastName: "Person",
      email: "",
      phone: "",
      roles: [],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors?.roles?.[0]).toMatch(/at least one role/i);
  });

  it("rejects a value the schema has never heard of, rather than storing it", async () => {
    const r = await createContact({
      firstName: "Odd",
      lastName: "Role",
      email: "",
      phone: "",
      roles: ["landlord's cousin"],
    });
    expect(r.ok).toBe(false);
  });
});

describe("creating a contact", () => {
  it("writes the contact, its roles and an audit row in one go", async () => {
    const email = `${unique("first.create")}@example.com`;
    const { id } = unwrap(
      await createContact({
        firstName: "Priya",
        lastName: unique("Testcase"),
        email,
        phone: "0412 000 111",
        suburb: "Prospect",
        roles: ["buyer", "investor"],
      }),
    );

    const [row] = await sql<
      { email_normalised: string; phone_e164: string; source_channel: string }[]
    >`select email_normalised, phone_e164, source_channel from contacts where id = ${id}`;
    expect(row.email_normalised).toBe(email.toLowerCase());
    // Normalisation happens on write, so matching later is a comparison not a guess.
    expect(row.phone_e164).toBe("+61412000111");
    expect(row.source_channel).toBe("manual");

    const roles = await sql<{ role: string }[]>`
      select role from contact_roles where contact_id = ${id} order by role`;
    expect(roles.map((r) => r.role)).toEqual(["buyer", "investor"]);

    const audit = await sql<{ action: string }[]>`
      select action from audit_log where entity_id = ${id} and kind = 'edit'`;
    expect(audit.map((a) => a.action)).toContain("Created contact");
  });

  it("strips plus-addressing so a duplicate cannot hide behind it", async () => {
    const { id } = unwrap(
      await createContact({
        firstName: "Plus",
        lastName: unique("Address"),
        email: "Someone+houses@Example.COM",
        phone: "",
        roles: ["buyer"],
      }),
    );
    const [row] = await sql<{ email_normalised: string; email_raw: string }[]>`
      select email_normalised, email_raw from contacts where id = ${id}`;
    expect(row.email_normalised).toBe("someone@example.com");
    // The raw form is kept, because that is the address they actually typed.
    expect(row.email_raw).toBe("Someone+houses@Example.COM");
  });
});

describe("a duplicate raises a merge review instead of being refused or merged", () => {
  it("creates the second record AND opens a review naming what matched", async () => {
    const email = `${unique("dupe")}@example.com`;
    const first = unwrap(
      await createContact({
        firstName: "Dana",
        lastName: unique("Original"),
        email,
        phone: "",
        roles: ["buyer"],
      }),
    );

    const second = unwrap(
      await createContact({
        firstName: "Dana",
        lastName: unique("Duplicate"),
        email: email.toUpperCase(),
        phone: "",
        roles: ["vendor"],
      }),
    );

    // Both exist. Refusing the second would lose the enquiry; merging it would decide
    // something only a person is allowed to decide.
    expect(second.id).not.toBe(first.id);
    expect(second.duplicateOf).toBe(first.id);

    const [review] = await sql<{ matched_on: string; status: string }[]>`
      select matched_on, status from merge_reviews
      where contact_a_id = ${first.id} and contact_b_id = ${second.id}`;
    expect(review.status).toBe("open");
    expect(review.matched_on).toMatch(/same email/i);
  });

  it("matches on phone even when the two were typed in different formats", async () => {
    const phone = "0433 900 123";
    const first = unwrap(
      await createContact({
        firstName: "Same",
        lastName: unique("Phone"),
        email: "",
        phone,
        roles: ["buyer"],
      }),
    );
    const second = unwrap(
      await createContact({
        firstName: "Same",
        lastName: unique("Phone"),
        email: "",
        phone: "+61433900123",
        roles: ["buyer"],
      }),
    );
    expect(second.duplicateOf).toBe(first.id);
  });
});

describe("resolving a merge review", () => {
  async function buildPair() {
    const phone = `04${String(31_000_000 + created * 7).slice(0, 8)}`;
    const older = unwrap(
      await createContact({
        firstName: "Older",
        lastName: unique("Survivor"),
        email: "",
        phone,
        suburb: "Norwood",
        roles: ["buyer"],
      }),
    );
    const newer = unwrap(
      await createContact({
        firstName: "Newer",
        lastName: unique("Loser"),
        email: `${unique("newer")}@example.com`,
        phone,
        roles: ["vendor"],
        doNotContact: true,
      }),
    );
    const [review] = await sql<{ id: string }[]>`
      select id from merge_reviews
      where contact_a_id = ${older.id} and contact_b_id = ${newer.id}`;
    return { older: older.id, newer: newer.id, reviewId: review.id };
  }

  it("keeps the older record, tombstones the newer, and points one at the other", async () => {
    const { older, newer, reviewId } = await buildPair();
    unwrap(await resolveMergeReview({ id: reviewId, decision: "merged" }));

    const [loser] = await sql<{ merged_into_id: string; tombstoned_at: Date }[]>`
      select merged_into_id, tombstoned_at from contacts where id = ${newer}`;
    expect(loser.merged_into_id).toBe(older);
    expect(loser.tombstoned_at).not.toBeNull();

    const [survivor] = await sql<{ merged_into_id: string | null }[]>`
      select merged_into_id from contacts where id = ${older}`;
    expect(survivor.merged_into_id).toBeNull();
  });

  it("fills the survivor's gaps without overwriting what it already had", async () => {
    const { older, newer, reviewId } = await buildPair();
    const [before] = await sql<{ phone_raw: string; suburb: string }[]>`
      select phone_raw, suburb from contacts where id = ${older}`;

    unwrap(await resolveMergeReview({ id: reviewId, decision: "merged" }));

    const [after] = await sql<
      { email_normalised: string; phone_raw: string; suburb: string }[]
    >`select email_normalised, phone_raw, suburb from contacts where id = ${older}`;
    const [loser] = await sql<{ email_normalised: string }[]>`
      select email_normalised from contacts where id = ${newer}`;

    // The survivor had no email, so it takes the loser's.
    expect(after.email_normalised).toBe(loser.email_normalised);
    // It had a phone and a suburb, so those are untouched.
    expect(after.phone_raw).toBe(before.phone_raw);
    expect(after.suburb).toBe(before.suburb);
  });

  it("never relaxes do-not-contact when merging", async () => {
    const { older, reviewId } = await buildPair();
    unwrap(await resolveMergeReview({ id: reviewId, decision: "merged" }));
    const [survivor] = await sql<{ do_not_contact: boolean }[]>`
      select do_not_contact from contacts where id = ${older}`;
    // The loser had it set. The strictest of the two has to win, or a merge becomes a
    // way to launder a request never to be contacted again.
    expect(survivor.do_not_contact).toBe(true);
  });

  it("moves roles the survivor does not already hold", async () => {
    const { older, reviewId } = await buildPair();
    unwrap(await resolveMergeReview({ id: reviewId, decision: "merged" }));
    const roles = await sql<{ role: string }[]>`
      select role from contact_roles where contact_id = ${older} order by role`;
    // Buyer was already there; vendor came across. One person, accumulating roles.
    expect(roles.map((r) => r.role)).toEqual(["buyer", "vendor"]);
  });

  it("leaves the interaction log attached to the record it was captured against", async () => {
    const { older, newer, reviewId } = await buildPair();
    unwrap(
      await logInteraction({
        contactId: newer,
        channel: "phone",
        direction: "in",
        subject: "Rang about Powell St",
        body: "Asked whether the rear shed is council-approved.",
      }),
    );

    unwrap(await resolveMergeReview({ id: reviewId, decision: "merged" }));

    const [still] = await sql<{ n: number }[]>`
      select count(*)::int as n from interactions where contact_id = ${newer}`;
    // Repointing it would have been the obvious implementation and the wrong one:
    // interactions are append-only precisely so that what was recorded, and against
    // whom, cannot be rewritten afterwards.
    expect(still.n).toBe(1);

    const { getInteractionsFor } = await import("@/server/queries");
    const log = await getInteractionsFor(older);
    const carried = log.find((i) => i.subject === "Rang about Powell St");
    // The survivor's screen still shows it — by following the pointer on read, and
    // saying where it came from.
    expect(carried).toBeTruthy();
    expect(carried!.viaMergedRecord?.id).toBe(newer);
  });

  it("refuses a chain, so following the pointer is always one hop", async () => {
    const { older, newer, reviewId } = await buildPair();
    unwrap(await resolveMergeReview({ id: reviewId, decision: "merged" }));

    const third = unwrap(
      await createContact({
        firstName: "Third",
        lastName: unique("Party"),
        email: "",
        phone: "",
        roles: ["buyer"],
      }),
    );

    let message: string | null = null;
    try {
      await sql`update contacts set merged_into_id = ${third.id}, tombstoned_at = now()
                where id = ${older}`;
    } catch (e) {
      message = (e as Error).message;
    }
    // `older` already has a record merged into it. Allowing this would make the
    // survivor of `newer` a record that is itself superseded.
    expect(message).toMatch(/merged into it/i);
  });

  it("records keeping both, so the same pair is not re-decided next week", async () => {
    const { reviewId } = await buildPair();
    unwrap(await resolveMergeReview({ id: reviewId, decision: "kept_both" }));
    const [review] = await sql<{ status: string; resolved_at: Date }[]>`
      select status, resolved_at from merge_reviews where id = ${reviewId}`;
    expect(review.status).toBe("kept_both");
    expect(review.resolved_at).not.toBeNull();
  });

  it("refuses to decide the same review twice", async () => {
    const { reviewId } = await buildPair();
    unwrap(await resolveMergeReview({ id: reviewId, decision: "kept_both" }));
    const again = await resolveMergeReview({ id: reviewId, decision: "merged" });
    expect(again.ok).toBe(false);
  });
});

describe("the manual adapter", () => {
  it("writes a typed-up call through the same table as an email", async () => {
    const { id } = unwrap(
      await createContact({
        firstName: "Manual",
        lastName: unique("Entry"),
        email: "",
        phone: "",
        roles: ["buyer"],
      }),
    );

    unwrap(
      await logInteraction({
        contactId: id,
        channel: "manual",
        direction: "in",
        subject: "Doorknock",
        body: "Mentioned they are thinking about selling in spring.",
      }),
    );

    const [row] = await sql<{ channel: string; body: string }[]>`
      select channel, body from interactions where contact_id = ${id}`;
    expect(row.channel).toBe("manual");
    expect(row.body).toMatch(/spring/);
  });

  it("cannot then be edited, because a correction is a new row", async () => {
    const { id } = unwrap(
      await createContact({
        firstName: "Immutable",
        lastName: unique("Log"),
        email: "",
        phone: "",
        roles: ["buyer"],
      }),
    );
    unwrap(
      await logInteraction({
        contactId: id,
        channel: "phone",
        direction: "in",
        body: "Said 4 bedrooms.",
      }),
    );

    let message: string | null = null;
    try {
      await sql`update interactions set body = 'Said 5 bedrooms.' where contact_id = ${id}`;
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/append-only/i);
  });
});

describe("recording a follow-up outcome", () => {
  it("updates the contact and leaves an interaction behind it", async () => {
    const { id } = unwrap(
      await createContact({
        firstName: "Followup",
        lastName: unique("Subject"),
        email: "",
        phone: "",
        roles: ["buyer"],
      }),
    );

    unwrap(
      await recordFollowupOutcome({
        contactId: id,
        outcome: "Wants to see Powell St before making an offer.",
        channel: "phone",
        nextDueInDays: 7,
      }),
    );

    const [c] = await sql<
      { last_followup_outcome: string; last_followup_at: Date; followup_due_at: Date }[]
    >`select last_followup_outcome, last_followup_at, followup_due_at
       from contacts where id = ${id}`;
    expect(c.last_followup_outcome).toMatch(/Powell St/);
    expect(c.last_followup_at).not.toBeNull();
    expect(c.followup_due_at).not.toBeNull();

    // An outcome with no touch behind it is a claim with nothing underneath it.
    const [i] = await sql<{ body: string; direction: string }[]>`
      select body, direction from interactions where contact_id = ${id}`;
    expect(i.body).toMatch(/Powell St/);
    expect(i.direction).toBe("out");
  });

  it("clears the due date when no follow-up is scheduled", async () => {
    const { id } = unwrap(
      await createContact({
        firstName: "Nofollow",
        lastName: unique("Up"),
        email: "",
        phone: "",
        roles: ["buyer"],
      }),
    );
    unwrap(
      await recordFollowupOutcome({
        contactId: id,
        outcome: "Bought elsewhere. Nothing further.",
        channel: "phone",
        nextDueInDays: 0,
      }),
    );
    const [c] = await sql<{ followup_due_at: Date | null }[]>`
      select followup_due_at from contacts where id = ${id}`;
    expect(c.followup_due_at).toBeNull();
  });

  it("refuses an outcome too short to mean anything", async () => {
    const { id } = unwrap(
      await createContact({
        firstName: "Terse",
        lastName: unique("Note"),
        email: "",
        phone: "",
        roles: ["buyer"],
      }),
    );
    const r = await recordFollowupOutcome({
      contactId: id,
      outcome: "ok",
      channel: "phone",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors?.outcome?.[0]).toMatch(/say what happened/i);
  });
});

describe("the confirm queue (rule 5: nothing writes without a human)", () => {
  async function queueItem(kind: "task" | "preference_change") {
    const { id } = unwrap(
      await createContact({
        firstName: "Queued",
        lastName: unique("Proposal"),
        email: "",
        phone: "",
        roles: ["buyer"],
      }),
    );
    const [item] = await sql<{ id: string }[]>`
      insert into confirm_items (tenant_id, contact_id, kind, summary, after_text, confidence)
      values (${h.session!.user.tenantId}, ${id}, ${kind},
              ${"Call back about the shed approval"}, ${"Proposed task"}, 0.82)
      returning id`;
    return { contactId: id, itemId: item.id };
  }

  it("writes nothing to the contact until the item is committed", async () => {
    const { contactId } = await queueItem("task");
    const [t] = await sql<{ n: number }[]>`
      select count(*)::int as n from tasks where contact_id = ${contactId}`;
    expect(t.n).toBe(0);
  });

  it("creates the task on commit and records who committed it", async () => {
    const { contactId, itemId } = await queueItem("task");
    unwrap(await commitConfirmItem({ id: itemId }));

    const [t] = await sql<{ title: string; source_label: string }[]>`
      select title, source_label from tasks where contact_id = ${contactId}`;
    expect(t.title).toMatch(/shed approval/);
    expect(t.source_label).toMatch(/confirm queue/i);

    const [item] = await sql<{ status: string; committed_by_user_id: string }[]>`
      select status, committed_by_user_id from confirm_items where id = ${itemId}`;
    expect(item.status).toBe("committed");
    expect(item.committed_by_user_id).toBe(h.session!.user.id);
  });

  it("refuses a second commit, so a double click cannot create two tasks", async () => {
    const { contactId, itemId } = await queueItem("task");
    unwrap(await commitConfirmItem({ id: itemId }));
    const again = await commitConfirmItem({ id: itemId });
    expect(again.ok).toBe(false);

    const [t] = await sql<{ n: number }[]>`
      select count(*)::int as n from tasks where contact_id = ${contactId}`;
    expect(t.n).toBe(1);
  });

  it("discarding writes nothing but is still recorded", async () => {
    const { contactId, itemId } = await queueItem("task");
    unwrap(await discardConfirmItem({ id: itemId }));

    const [t] = await sql<{ n: number }[]>`
      select count(*)::int as n from tasks where contact_id = ${contactId}`;
    expect(t.n).toBe(0);

    const [audit] = await sql<{ kind: string }[]>`
      select kind from audit_log where entity_id = ${itemId}`;
    // A rejection is evidence too: it is how you show the AI was overruled.
    expect(audit.kind).toBe("reject");
  });
});

describe("a privacy tombstone", () => {
  it("marks the contact and its interactions without deleting either", async () => {
    const { id } = unwrap(
      await createContact({
        firstName: "Erase",
        lastName: unique("Me"),
        email: "",
        phone: "",
        roles: ["buyer"],
      }),
    );
    unwrap(
      await logInteraction({
        contactId: id,
        channel: "email",
        direction: "in",
        body: "Please remove my details.",
      }),
    );

    unwrap(await tombstoneContact({ contactId: id, reason: "Deletion request by email" }));

    const [c] = await sql<{ tombstoned_at: Date; do_not_contact: boolean }[]>`
      select tombstoned_at, do_not_contact from contacts where id = ${id}`;
    expect(c.tombstoned_at).not.toBeNull();
    expect(c.do_not_contact).toBe(true);

    const [i] = await sql<{ n: number; live: number }[]>`
      select count(*)::int as n,
             count(*) filter (where tombstoned_at is null)::int as live
      from interactions where contact_id = ${id}`;
    // The rows survive, because they are the evidence for anything already sent.
    expect(i.n).toBe(1);
    expect(i.live).toBe(0);
  });

  it("cannot be reversed", async () => {
    const { id } = unwrap(
      await createContact({
        firstName: "Final",
        lastName: unique("Decision"),
        email: "",
        phone: "",
        roles: ["buyer"],
      }),
    );
    unwrap(
      await logInteraction({
        contactId: id,
        channel: "email",
        direction: "in",
        body: "Remove me.",
      }),
    );
    unwrap(await tombstoneContact({ contactId: id, reason: "Deletion request" }));

    let message: string | null = null;
    try {
      await sql`update interactions set tombstoned_at = null where contact_id = ${id}`;
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/cannot be reversed/i);
  });

  it("drops the contact out of the list without erasing it", async () => {
    const { getContacts, getContact } = await import("@/server/queries");
    const { id } = unwrap(
      await createContact({
        firstName: "Hidden",
        lastName: unique("Record"),
        email: "",
        phone: "",
        roles: ["buyer"],
      }),
    );
    unwrap(await tombstoneContact({ contactId: id, reason: "Deletion request" }));

    const list = await getContacts();
    expect(list.find((c) => c.id === id)).toBeUndefined();
    // Still reachable by id, because the audit trail points at it.
    expect(await getContact(id)).not.toBeNull();
  });
});

describe("a superseded or removed record takes no new activity", () => {
  async function merged() {
    const phone = `04${String(52_000_000 + created * 13).slice(0, 8)}`;
    const older = unwrap(
      await createContact({
        firstName: "Kept",
        lastName: unique("Record"),
        email: "",
        phone,
        roles: ["buyer"],
      }),
    );
    const newer = unwrap(
      await createContact({
        firstName: "Gone",
        lastName: unique("Record"),
        email: "",
        phone,
        roles: ["buyer"],
      }),
    );
    const [review] = await sql<{ id: string }[]>`
      select id from merge_reviews
      where contact_a_id = ${older.id} and contact_b_id = ${newer.id}`;
    unwrap(await resolveMergeReview({ id: review.id, decision: "merged" }));
    return { older: older.id, newer: newer.id };
  }

  it("refuses to log an interaction against a merged-away record", async () => {
    const { newer } = await merged();
    const r = await logInteraction({
      contactId: newer,
      channel: "phone",
      direction: "in",
      body: "Rang the old number.",
    });
    expect(r.ok).toBe(false);
    // Hiding the button is not the guard. A stale tab still has the action.
    if (!r.ok) expect(r.error).toMatch(/merged into another/i);
  });

  it("still allows it against the surviving record", async () => {
    const { older } = await merged();
    const r = await logInteraction({
      contactId: older,
      channel: "phone",
      direction: "in",
      body: "Rang about the shed.",
    });
    expect(r.ok).toBe(true);
  });

  it("refuses new activity against a contact who asked to be removed", async () => {
    const { id } = unwrap(
      await createContact({
        firstName: "Removed",
        lastName: unique("Person"),
        email: "",
        phone: "",
        roles: ["buyer"],
      }),
    );
    unwrap(await tombstoneContact({ contactId: id, reason: "Deletion request" }));
    const r = await recordFollowupOutcome({
      contactId: id,
      outcome: "Called them anyway.",
      channel: "phone",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/asked to be removed/i);
  });
});

describe("refusals reach the user in the words the handler chose", () => {
  it("does not flatten a deliberate message into 'something went wrong'", async () => {
    const r = await commitConfirmItem({ id: "00000000-0000-4000-8000-000000000000" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/no longer in the queue/i);
      expect(r.error).not.toMatch(/something went wrong/i);
    }
  });
});

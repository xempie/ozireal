import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { systemTenantId, withTenant } from "@/db";

/**
 * The send gate (B5.5) — rules 1 and 2, tested where they live.
 *
 * These are the tests that matter most in the product. Every one of them asks the
 * same question from a different angle: can a message reach someone who did not
 * agree to receive it? The answer has to be no, and it has to stay no after a
 * refactor written by someone who has never read CLAUDE.md.
 */

vi.mock("@/server/jobs/queues", () => ({
  enqueue: async () => true,
  getQueue: () => ({ close: async () => {} }),
}));

const h = vi.hoisted(() => ({
  session: {
    user: { id: "", name: "Sam Whitfield", email: "sam@ozirealty.com.au", tenantId: "", role: "principal" },
  } as { user: Record<string, string> } | null,
}));
vi.mock("@/auth", () => ({ auth: async () => h.session }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

const { checkConsent, withComplianceFooter } = await import("@/server/outbound/gate");
const { approveAndSend, rejectDraft, editDraft } = await import("@/server/actions/approvals");

let sql: postgres.Sql;
let tenantId: string;
let seq = 0;

beforeAll(async () => {
  sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  tenantId = await systemTenantId();
  const [u] = await sql<{ id: string }[]>`select id from users limit 1`;
  h.session!.user.tenantId = tenantId;
  h.session!.user.id = u.id;
});
afterAll(async () => {
  await sql?.end();
});
beforeEach(() => {
  // Never a real provider in tests: MessageMedia credentials stay absent, so a
  // send that got past the gate fails at the wire rather than texting anyone.
  delete process.env.MESSAGEMEDIA_KEY;
  delete process.env.MESSAGEMEDIA_SECRET;
});

async function makeContact(over: { doNotContact?: boolean; tombstoned?: boolean } = {}) {
  seq += 1;
  const [c] = await sql<{ id: string }[]>`
    insert into contacts (tenant_id, first_name, last_name, email_raw, email_normalised,
                          phone_e164, source_channel, do_not_contact, tombstoned_at)
    values (${tenantId}, 'Gate', ${`Case${seq}`},
            ${`gate${seq}.${Date.now() % 100000}@example.com`},
            ${`gate${seq}.${Date.now() % 100000}@example.com`},
            ${`+6141${String(1000000 + seq).slice(0, 7)}`}, 'web_form',
            ${over.doNotContact ?? false}, ${over.tombstoned ? new Date() : null})
    returning id`;
  return c.id;
}

async function grantConsent(
  contactId: string,
  channel: "email" | "sms",
  status: "granted" | "revoked",
  at = new Date(),
) {
  await sql`
    insert into consents (tenant_id, contact_id, channel, status, source_form, wording_shown, occurred_at)
    values (${tenantId}, ${contactId}, ${channel}, ${status}, 'Website enquiry',
            'I agree to Ozi Realty contacting me about properties.', ${at})`;
}

async function makeDraft(contactId: string, kind: "email" | "sms" = "email") {
  const [a] = await sql<{ id: string }[]>`
    insert into approval_items (tenant_id, kind, status, contact_id, draft_subject, draft_body)
    values (${tenantId}, ${kind}, 'pending', ${contactId}, 'A property you might like',
            'Hi, 12 Powell St just came up and it looks close to what you described.')
    returning id`;
  return a.id;
}

const gate = (contactId: string, channel: "email" | "sms" | "phone" = "email") =>
  withTenant(tenantId, (tx) => checkConsent(tx, contactId, channel));

describe("the consent gate", () => {
  it("allows a send where consent was granted and never withdrawn", async () => {
    const id = await makeContact();
    await grantConsent(id, "email", "granted");
    const d = await gate(id);
    expect(d.allowed).toBe(true);
  });

  it("refuses where consent was never recorded — silence is not consent", async () => {
    const id = await makeContact();
    const d = await gate(id);
    expect(d.allowed).toBe(false);
    if (!d.allowed) {
      expect(d.consentStatus).toBe("never_given");
      expect(d.reason).toMatch(/has ever been recorded/i);
    }
  });

  it("refuses after a revocation, even though a grant exists earlier", async () => {
    const id = await makeContact();
    const week = 7 * 86_400_000;
    await grantConsent(id, "email", "granted", new Date(Date.now() - week));
    await grantConsent(id, "email", "revoked", new Date());
    const d = await gate(id);
    // The LATEST row is the current state. Consents are append-only, so the
    // grant is still there — and must not win.
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.consentStatus).toBe("revoked");
  });

  it("respects order by when it HAPPENED, not when it was recorded", async () => {
    const id = await makeContact();
    // Revocation happened yesterday but was entered second; a grant that happened
    // today is entered first. Ordering by created_at would get this backwards.
    await grantConsent(id, "email", "granted", new Date());
    await grantConsent(id, "email", "revoked", new Date(Date.now() - 86_400_000));
    const d = await gate(id);
    expect(d.allowed).toBe(true);
  });

  it("refuses do-not-contact regardless of channel consent", async () => {
    const id = await makeContact({ doNotContact: true });
    await grantConsent(id, "email", "granted");
    const d = await gate(id);
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toMatch(/do-not-contact/i);
  });

  it("refuses a tombstoned contact — a privacy deletion ends contact", async () => {
    const id = await makeContact({ tombstoned: true });
    await grantConsent(id, "email", "granted");
    const d = await gate(id);
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toMatch(/privacy request/i);
  });

  it("is per channel: email consent does not authorise SMS", async () => {
    const id = await makeContact();
    await grantConsent(id, "email", "granted");
    expect((await gate(id, "email")).allowed).toBe(true);
    expect((await gate(id, "sms")).allowed).toBe(false);
  });

  it("honours a revocation recorded against a record merged into this one", async () => {
    const survivor = await makeContact();
    const loser = await makeContact();
    await grantConsent(survivor, "email", "granted", new Date(Date.now() - 86_400_000));
    // They unsubscribed via the duplicate. That is still an unsubscribe.
    await grantConsent(loser, "email", "revoked", new Date());
    await sql`update contacts set merged_into_id = ${survivor}, tombstoned_at = now()
              where id = ${loser}`;

    const d = await gate(survivor);
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.consentStatus).toBe("revoked");
  });
});

describe("approve and send", () => {
  it("blocks rather than sending when consent lapsed after drafting", async () => {
    const id = await makeContact();
    await grantConsent(id, "email", "granted", new Date(Date.now() - 3 * 86_400_000));
    const draftId = await makeDraft(id);
    // Monday's draft, Wednesday's unsubscribe, Thursday's approval.
    await grantConsent(id, "email", "revoked", new Date(Date.now() - 86_400_000));

    const r = await approveAndSend({ id: draftId });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.sent).toBe(false);
      expect(r.data.blocked).toBe(true);
    }

    const [row] = await sql<{ status: string; block_reason: string; sent_at: Date | null }[]>`
      select status, block_reason, sent_at from approval_items where id = ${draftId}`;
    expect(row.status).toBe("blocked");
    expect(row.block_reason).toBeTruthy();
    expect(row.sent_at).toBeNull();

    // No interaction: nothing happened to this contact.
    const [n] = await sql<{ n: number }[]>`
      select count(*)::int as n from interactions where contact_id = ${id} and direction = 'out'`;
    expect(n.n).toBe(0);
  });

  it("records the refusal as an auditable block, not a silent no-op", async () => {
    const id = await makeContact({ doNotContact: true });
    const draftId = await makeDraft(id);
    await approveAndSend({ id: draftId });

    const [audit] = await sql<{ kind: string; action: string }[]>`
      select kind, action from audit_log where entity_id = ${draftId} order by occurred_at desc limit 1`;
    expect(audit.kind).toBe("block");
    expect(audit.action).toMatch(/refused a send/i);
  });

  it("refuses to send an item that was already handled", async () => {
    const id = await makeContact();
    await grantConsent(id, "email", "granted");
    const draftId = await makeDraft(id);
    // sent_at is required alongside status='sent' (approval_sent_has_timestamp),
    // so even the test fixture cannot fake a send without a timestamp.
    await sql`update approval_items set status = 'sent', sent_at = now() where id = ${draftId}`;
    const r = await approveAndSend({ id: draftId });
    expect(r.ok).toBe(false);
  });

  it("does not mark a draft sent when the provider refuses it", async () => {
    const id = await makeContact();
    await grantConsent(id, "sms", "granted");
    const draftId = await makeDraft(id, "sms");
    // No MessageMedia credentials in tests, so the wire fails after the gate allowed.
    const r = await approveAndSend({ id: draftId });
    expect(r.ok).toBe(false);

    const [row] = await sql<{ status: string }[]>`
      select status from approval_items where id = ${draftId}`;
    // Still pending: a provider failure must not lose the draft or fake a send.
    expect(row.status).toBe("pending");
  });

  it("will not send a social post through the message gate", async () => {
    const id = await makeContact();
    const [a] = await sql<{ id: string }[]>`
      insert into approval_items (tenant_id, kind, status, contact_id, draft_body)
      values (${tenantId}, 'social', 'pending', ${id}, 'New listing on Powell St')
      returning id`;
    const r = await approveAndSend({ id: a.id });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/not a direct message/i);
  });
});

describe("editing and rejecting", () => {
  it("keeps the AI's original wording the first time a human edits", async () => {
    const id = await makeContact();
    const draftId = await makeDraft(id);
    await editDraft({ id: draftId, body: "First human version." });
    await editDraft({ id: draftId, body: "Second human version." });

    const [row] = await sql<{ draft_body: string; original_body: string }[]>`
      select draft_body, original_body from approval_items where id = ${draftId}`;
    expect(row.draft_body).toBe("Second human version.");
    // The AI's text, not the intermediate human one — the audit shows what the
    // machine proposed against what actually went out.
    expect(row.original_body).toMatch(/Powell St just came up/);
  });

  it("requires a reason to reject, and stores it", async () => {
    const id = await makeContact();
    const draftId = await makeDraft(id);

    const bad = await rejectDraft({ id: draftId, reason: "x" });
    expect(bad.ok).toBe(false);

    const good = await rejectDraft({ id: draftId, reason: "Too pushy for a first contact." });
    expect(good.ok).toBe(true);

    const [row] = await sql<{ status: string; reject_reason: string }[]>`
      select status, reject_reason from approval_items where id = ${draftId}`;
    expect(row.status).toBe("rejected");
    expect(row.reject_reason).toMatch(/pushy/);
  });

  it("refuses to edit an item that was already handled", async () => {
    const id = await makeContact();
    const draftId = await makeDraft(id);
    await rejectDraft({ id: draftId, reason: "Not appropriate." });
    const r = await editDraft({ id: draftId, body: "Sneaking a change in." });
    expect(r.ok).toBe(false);
  });
});

describe("the compliance footer", () => {
  const agency = { name: "Ozi Realty", licence: "RLA 123456" };

  it("puts sender identification and an unsubscribe on every email", () => {
    const out = withComplianceFooter("Here is that listing.", agency, {
      channel: "email",
      url: "https://ozirealty.com.au/u/abc",
    });
    expect(out).toMatch(/Ozi Realty · RLA 123456/);
    expect(out).toMatch(/Unsubscribe: https/);
  });

  it("keeps SMS terse but never drops the opt-out", () => {
    const out = withComplianceFooter("12 Powell St is open Saturday.", agency, {
      channel: "sms",
      keyword: "STOP",
    });
    expect(out).toMatch(/Reply STOP to opt out/);
    expect(out).toMatch(/Ozi Realty/);
  });

  it("refuses to send a marketing email while no unsubscribe link exists", async () => {
    const id = await makeContact();
    await grantConsent(id, "email", "granted");
    const draftId = await makeDraft(id, "email");
    const r = await approveAndSend({ id: draftId });
    // Consent was fine — this refusal is about the message being unlawful without
    // a working unsubscribe, not about permission.
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/unsubscribe/i);

    const [row] = await sql<{ status: string }[]>`
      select status from approval_items where id = ${draftId}`;
    expect(row.status).toBe("pending");
  });
});

describe("consent across a merged identity (B5 review)", () => {
  it("lets someone re-subscribe after unsubscribing", async () => {
    const id = await makeContact();
    await grantConsent(id, "email", "granted", new Date(Date.now() - 30 * 86_400_000));
    await grantConsent(id, "email", "revoked", new Date(Date.now() - 20 * 86_400_000));
    // They came back through the website and ticked the box again.
    await grantConsent(id, "email", "granted", new Date(Date.now() - 1 * 86_400_000));
    const d = await gate(id);
    // Strictest-wins over the whole history would bar them forever. People do
    // opt back in, and refusing that quietly loses real consent.
    expect(d.allowed).toBe(true);
  });

  it("still refuses when a MERGED record's current state is revoked", async () => {
    const survivor = await makeContact();
    const loser = await makeContact();
    await grantConsent(survivor, "email", "granted", new Date());
    // The duplicate's most recent state is revoked, and it is older than the
    // survivor's grant — pure latest-wins over the union would miss this.
    await grantConsent(loser, "email", "granted", new Date(Date.now() - 10 * 86_400_000));
    await grantConsent(loser, "email", "revoked", new Date(Date.now() - 5 * 86_400_000));
    await sql`update contacts set merged_into_id = ${survivor}, tombstoned_at = now()
              where id = ${loser}`;

    const d = await gate(survivor);
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toMatch(/merged into this one/i);
  });

  it("allows when the merged record re-granted after its revocation", async () => {
    const survivor = await makeContact();
    const loser = await makeContact();
    await grantConsent(survivor, "email", "granted", new Date(Date.now() - 20 * 86_400_000));
    await grantConsent(loser, "email", "revoked", new Date(Date.now() - 10 * 86_400_000));
    await grantConsent(loser, "email", "granted", new Date(Date.now() - 2 * 86_400_000));
    await sql`update contacts set merged_into_id = ${survivor}, tombstoned_at = now()
              where id = ${loser}`;

    const d = await gate(survivor);
    expect(d.allowed).toBe(true);
  });
});

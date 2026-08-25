import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { withTenant, systemTenantId } from "@/db";
import { contacts, consents, approvalItems } from "@/db/schema";
import { ingestThrough } from "@/server/intake";
import { toE164 } from "@/lib/normalise";
import { timingSafeEqual } from "node:crypto";

/** Constant-time string compare that does not leak length through an early exit. */
function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    // Still do a comparison so the timing does not distinguish "wrong length".
    timingSafeEqual(bb, bb);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

/**
 * Inbound SMS and delivery receipts (B5.6).
 *
 * Two webhook shapes on one route, distinguished by payload:
 *   - a REPLY (MO) becomes an interaction through the ordinary pipeline, because a
 *     text message is a channel like any other (§5);
 *   - a DELIVERY RECEIPT tells us what actually happened to something we sent.
 *
 * The one that matters most is neither: it is STOP. MessageMedia suppresses opted-
 * out numbers on its side, but a suppression we do not know about is a contact our
 * CRM still believes it may message. So an opt-out keyword writes a `consents`
 * revocation row HERE, in our database, where the send gate reads it.
 */

export const dynamic = "force-dynamic";

/**
 * The Spam Act requires the unsubscribe to work; it does not require the customer
 * to spell it correctly. These are the forms people actually send.
 */
const OPT_OUT = new Set([
  "stop", "stopall", "unsub", "unsubscribe", "end", "quit", "cancel",
  "optout", "remove",
]);

/**
 * Erring toward recognising an opt-out, but not so far that ordinary replies are
 * mistaken for one.
 *
 * "no" was in the first list and had to come out: "no thanks, we bought elsewhere"
 * is a normal reply, and treating it as an unsubscribe silently ends a real
 * relationship. Meanwhile a genuine "STOP SENDING ME THESE" was MISSED, because
 * the old rule only looked at the first and last word of messages up to three
 * words long. Now the check is: the whole message is a keyword, or it opens with
 * one. Found by the B5 review.
 */
function isOptOut(text: string): boolean {
  const cleaned = text
    .trim()
    .toLowerCase()
    .replace(/[.!?,]+$/g, "")
    .replace(/[‘’]/g, "'");
  if (!cleaned) return false;

  const collapsed = cleaned.replace(/[\s-]+/g, "");
  if (OPT_OUT.has(collapsed)) return true;

  const words = cleaned.split(/\s+/);
  // Opens with a keyword: "STOP", "stop sending me these", "unsubscribe please".
  if (OPT_OUT.has(words[0].replace(/[^a-z]/g, ""))) return true;
  // "please stop", "please unsubscribe me" — a short, plainly-directed request.
  if (words.length <= 4 && words[0] === "please" && OPT_OUT.has(words[1] ?? "")) return true;
  return false;
}

const reply = z.object({
  reply_id: z.string().optional(),
  message_id: z.string().optional(),
  source_number: z.string(),
  destination_number: z.string().optional(),
  content: z.string(),
  date_received: z.string().optional(),
});

const deliveryReport = z.object({
  delivery_report_id: z.string().optional(),
  message_id: z.string(),
  status: z.string(),
  status_code: z.union([z.string(), z.number()]).optional(),
  date_received: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Not JSON" }, { status: 400 });
  }

  /**
   * The webhook is a public URL, so it authenticates with a shared secret set on
   * the MessageMedia webhook configuration. Refused outright without one — an
   * open endpoint here would let anyone forge an opt-out, or worse, an opt-IN.
   */
  const tenantId = await systemTenantId();
  /**
   * A DEDICATED webhook secret, not the outbound API password.
   *
   * Reusing MESSAGEMEDIA_SECRET meant the credential that authorises sending was
   * also the one pasted into a third party's webhook configuration — so a leak
   * there became the ability to send as the agency, not merely to post a fake
   * reply. Compared in constant time, because a `!==` on a secret leaks its
   * prefix to anyone willing to measure. Found by the B5 review.
   */
  const expected = process.env.SMS_WEBHOOK_SECRET;
  const presented = req.headers.get("x-ozi-webhook-secret") ?? "";
  if (!expected || !timingSafeEqualStr(presented, expected)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 403 });
  }

  const asReply = reply.safeParse(payload);
  if (asReply.success) return handleReply(tenantId, asReply.data);

  const asDlr = deliveryReport.safeParse(payload);
  if (asDlr.success) return handleDeliveryReport(tenantId, asDlr.data);

  return NextResponse.json({ error: "Unrecognised webhook payload" }, { status: 422 });
}

async function handleReply(tenantId: string, r: z.infer<typeof reply>) {
  const from = toE164(r.source_number);
  /**
   * A provider timestamp we cannot parse becomes "now" rather than an Invalid
   * Date. The insert would have thrown on the invalid value and taken the whole
   * opt-out with it — losing the one message that must never be lost.
   */
  const parsed = r.date_received ? new Date(r.date_received) : null;
  const occurredAt = parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date();

  /**
   * Resolve FIRST, then revoke.
   *
   * The first version revoked before resolving, so an opt-out from a number we did
   * not yet know found no contact, dropped the revocation on the floor — and then
   * ingestReply created that very contact a moment later, with no opt-out on it.
   * The person who texted STOP became a fresh, contactable record. Found by the
   * B5 review.
   */
  const contactId = await resolveByPhone(tenantId, r.source_number);

  if (isOptOut(r.content)) {
    const revoked = await recordOptOut(tenantId, contactId, r.content, occurredAt);
    // Still ingest it: the message was sent and the log should show it. The
    // contact's history is where an agent sees WHY they stopped messaging.
    await ingestReply(tenantId, r, occurredAt, contactId);
    return NextResponse.json({ ok: true, optOut: true, revoked });
  }

  await ingestReply(tenantId, r, occurredAt, contactId);
  return NextResponse.json({ ok: true, optOut: false });
}

async function ingestReply(
  tenantId: string,
  r: z.infer<typeof reply>,
  occurredAt: Date,
  contactId: string,
) {
  await ingestThrough(
    "manual",
    {
      contactId,
      channel: "sms",
      direction: "in",
      subject: null,
      body: r.content,
      occurredAt,
      // The provider's id is the replay key. Without it a retrying webhook wrote
      // the same reply repeatedly — the dedupe index exists precisely for this.
      messageId: r.reply_id ?? r.message_id ?? null,
    },
    tenantId,
  ).catch((e) => {
    console.error("[inbound/sms] ingest failed:", e instanceof Error ? e.message : e);
  });
}

/**
 * The manual adapter takes a resolved contact id, so an SMS from an unknown
 * number needs one first. Creating a bare contact keeps the message — losing an
 * inbound text because we do not recognise the number is the one outcome intake
 * is not allowed to have (§5).
 */
async function resolveByPhone(tenantId: string, raw: string): Promise<string> {
  const e164 = toE164(raw);
  return withTenant(tenantId, async (tx) => {
    if (e164) {
      const [existing] = await tx
        .select({ id: contacts.id, mergedIntoId: contacts.mergedIntoId })
        .from(contacts)
        .where(eq(contacts.phoneE164, e164))
        .limit(1);
      if (existing) return existing.mergedIntoId ?? existing.id;
    }
    const [created] = await tx
      .insert(contacts)
      .values({
        tenantId,
        firstName: "Unknown",
        lastName: "SMS sender",
        phoneRaw: raw,
        phoneE164: e164,
        sourceChannel: "sms",
      })
      .returning({ id: contacts.id });
    return created.id;
  });
}

/**
 * An opt-out writes an append-only revocation, which is what the send gate reads.
 * It also sets do_not_contact, because someone who texts STOP has not made a
 * channel-specific request in their own mind — they have asked the agency to stop.
 */
async function recordOptOut(
  tenantId: string,
  contactId: string,
  content: string,
  occurredAt: Date,
): Promise<number> {
  return withTenant(tenantId, async (tx) => {
    /**
     * Every record that IS this person, not just the one the number resolved to.
     *
     * A number can sit on several rows while a merge review is open — that is the
     * whole reason merge reviews exist. Revoking on one of them left the others
     * contactable, so the send gate would happily use a duplicate to message
     * someone who had texted STOP. Found by the B5 review.
     */
    const [self] = await tx
      .select({ id: contacts.id, phoneE164: contacts.phoneE164 })
      .from(contacts)
      .where(eq(contacts.id, contactId))
      .limit(1);
    if (!self) return 0;

    const sameNumber = self.phoneE164
      ? await tx
          .select({ id: contacts.id })
          .from(contacts)
          .where(eq(contacts.phoneE164, self.phoneE164))
      : [];
    const mergedIn = await tx
      .select({ id: contacts.id })
      .from(contacts)
      .where(eq(contacts.mergedIntoId, contactId));

    const ids = [...new Set([contactId, ...sameNumber.map((c) => c.id), ...mergedIn.map((c) => c.id)])];

    for (const id of ids) {
      await tx.insert(consents).values({
        tenantId,
        contactId: id,
        channel: "sms",
        status: "revoked",
        sourceForm: "SMS opt-out keyword",
        // The evidence IS what they texted. Stored verbatim, like every other
        // consent record — this is the defence if the revocation is ever disputed.
        wordingShown: content.slice(0, 500),
        ipAddress: null,
        occurredAt,
      });
      await tx
        .update(contacts)
        .set({ doNotContact: true, updatedAt: new Date() })
        .where(eq(contacts.id, id));
    }

    return ids.length;
  });
}

/**
 * Delivery receipts. Status 302 is the one that carries information the API call
 * could not: MessageMedia suppressed the message because the number is on its
 * opt-out blacklist. Our database did not know, so it learns here.
 */
async function handleDeliveryReport(tenantId: string, d: z.infer<typeof deliveryReport>) {
  const code = String(d.status_code ?? "");
  const suppressed = code === "302";

  await withTenant(tenantId, async (tx) => {
    const [item] = await tx
      .select({ id: approvalItems.id, contactId: approvalItems.contactId })
      .from(approvalItems)
      .where(eq(approvalItems.providerMessageId, d.message_id))
      .orderBy(desc(approvalItems.createdAt))
      .limit(1);
    if (!item) return;

    if (suppressed) {
      /**
       * It was never delivered, so "sent" is no longer true. Reclassifying it as
       * blocked with the reason keeps the record honest — and the constraint
       * requires the reason, which is exactly the point of that constraint.
       */
      await tx
        .update(approvalItems)
        .set({
          status: "blocked",
          blockReason:
            "Suppressed by the provider: the number is on the carrier opt-out list. The recipient had unsubscribed.",
        })
        .where(eq(approvalItems.id, item.id));

      if (item.contactId) {
        /**
         * The CURRENT state, not "has there ever been a revocation".
         *
         * Testing for any historical revocation meant a contact who unsubscribed,
         * later re-subscribed, and then hit a stale carrier blacklist entry was
         * never re-revoked — our database kept saying granted while the carrier
         * suppressed every message. Found by the B5 review.
         */
        const [current] = await tx
          .select({ status: consents.status })
          .from(consents)
          .where(and(eq(consents.contactId, item.contactId), eq(consents.channel, "sms")))
          .orderBy(desc(consents.occurredAt), desc(consents.createdAt))
          .limit(1);
        if (current?.status !== "revoked") {
          await tx.insert(consents).values({
            tenantId,
            contactId: item.contactId,
            channel: "sms",
            status: "revoked",
            sourceForm: "Carrier opt-out list (delivery receipt 302)",
            wordingShown:
              "The provider reported this number as opted out when a message was attempted.",
            ipAddress: null,
            occurredAt: d.date_received ? new Date(d.date_received) : new Date(),
          });
          await tx
            .update(contacts)
            .set({ doNotContact: true })
            .where(eq(contacts.id, item.contactId));
        }
      }
    }
  });

  return NextResponse.json({ ok: true, suppressed });
}

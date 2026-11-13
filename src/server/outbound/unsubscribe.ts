import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { withTenant } from "@/db";
import { contacts, consents, interactions } from "@/db/schema";
import { env } from "@/env";

/**
 * The email unsubscribe facility (Spam Act s18, §10), 2026-11-12.
 *
 * Every marketing email carries a link with a signed token naming the tenant, the
 * contact and the channel. Opening it shows one button; pressing it (or a mail client's
 * one-click List-Unsubscribe POST) records a `revoked` consent row, which the send gate
 * reads on the very next send. No login, no expiry: the Act requires the facility to work
 * for at least 30 days after sending, and a link that dies would breach it.
 */

const SITE = "https://www.ozirealty.com.au";

function key() {
  const k = process.env.UNSUBSCRIBE_SECRET ?? env.AUTH_SECRET;
  if (!k) throw new Error("No secret to sign unsubscribe links with (AUTH_SECRET).");
  return k;
}

const b64 = (b: Buffer) => b.toString("base64url");

export function unsubscribeToken(tenantId: string, contactId: string, channel: "email" = "email") {
  const payload = `${tenantId}.${contactId}.${channel}`;
  const sig = createHmac("sha256", key()).update(payload).digest();
  return `${b64(Buffer.from(payload))}.${b64(sig.subarray(0, 18))}`;
}

export function unsubscribeUrl(tenantId: string, contactId: string) {
  return `${SITE}/unsubscribe?t=${unsubscribeToken(tenantId, contactId)}`;
}

export function readUnsubscribeToken(token: string): { tenantId: string; contactId: string; channel: "email" } | null {
  const [p, s] = token.split(".");
  if (!p || !s) return null;
  let payload: string;
  try {
    payload = Buffer.from(p, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const want = createHmac("sha256", key()).update(payload).digest().subarray(0, 18);
  const got = Buffer.from(s, "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  const [tenantId, contactId, channel] = payload.split(".");
  const uuid = /^[0-9a-f-]{36}$/i;
  if (!uuid.test(tenantId ?? "") || !uuid.test(contactId ?? "") || channel !== "email") return null;
  return { tenantId, contactId, channel };
}

export const UNSUBSCRIBE_WORDING = "Unsubscribed from Ozi Realty marketing emails using the link in an email.";

/** Records the withdrawal. Safe to repeat: a second press adds nothing new. */
export async function applyUnsubscribe(
  t: { tenantId: string; contactId: string },
  ip: string | null,
): Promise<{ ok: boolean; firstName: string | null }> {
  return withTenant(t.tenantId, async (tx) => {
    const [c] = await tx
      .select({ id: contacts.id, firstName: contacts.firstName })
      .from(contacts)
      .where(eq(contacts.id, t.contactId))
      .limit(1);
    if (!c) return { ok: false, firstName: null };
    const now = new Date();
    await tx.insert(consents).values({
      tenantId: t.tenantId,
      contactId: c.id,
      channel: "email",
      status: "revoked",
      sourceForm: "email_unsubscribe_link",
      wordingShown: UNSUBSCRIBE_WORDING,
      ipAddress: ip,
      occurredAt: now,
    });
    await tx.insert(interactions).values({
        tenantId: t.tenantId,
        contactId: c.id,
        channel: "email",
        direction: "in",
        occurredAt: now,
        subject: "Unsubscribed from marketing emails",
        body: UNSUBSCRIBE_WORDING,
      });
    return { ok: true, firstName: c.firstName };
  });
}

/** Whether this contact's latest email consent is already a withdrawal. */
export async function isUnsubscribed(t: { tenantId: string; contactId: string }) {
  return withTenant(t.tenantId, async (tx) => {
    const rows = await tx
      .select({ status: consents.status, at: consents.occurredAt })
      .from(consents)
      .where(and(eq(consents.contactId, t.contactId), eq(consents.channel, "email")));
    const latest = rows.sort((a, b) => +b.at - +a.at)[0];
    return latest?.status === "revoked";
  });
}

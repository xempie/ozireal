import { eq } from "drizzle-orm";
import { withTenant } from "@/db";
import { contacts } from "@/db/schema";
import { getSecret } from "@/server/secrets";
import { withComplianceFooter } from "./gate";

/**
 * Actually putting a message on the wire (B5.6).
 *
 * Called ONLY from approveAndSend, after the consent gate has allowed it. This
 * module has no idea whether consent was checked and does not check it — that
 * separation is deliberate: one gate, in one place, that every send goes through,
 * rather than a second opinion here that could drift out of agreement with it.
 */

export type SendResult =
  | { ok: true; providerMessageId: string | null; sentBody: string }
  | { ok: false; error: string };

export type SendRequest = {
  tenantId: string;
  contactId: string;
  channel: "email" | "sms";
  subject: string | null;
  body: string;
  agency: { name: string; licence: string | null };
};

export async function sendMessage(req: SendRequest): Promise<SendResult> {
  const [contact] = await withTenant(req.tenantId, (tx) =>
    tx
      .select({
        email: contacts.emailRaw,
        phone: contacts.phoneE164,
        firstName: contacts.firstName,
      })
      .from(contacts)
      .where(eq(contacts.id, req.contactId))
      .limit(1),
  );
  if (!contact) return { ok: false, error: "Contact not found" };

  /**
   * The footer is composed per channel, inside each branch, because each channel
   * has a DIFFERENT unsubscribe facility and the type now insists on the matching
   * one. §10: sender identification and a working unsubscribe on every message.
   */
  if (req.channel === "sms") {
    if (!contact.phone) return { ok: false, error: "No mobile number on file" };
    const body = withComplianceFooter(req.body, req.agency, {
      channel: "sms",
      keyword: "STOP",
    });
    return sendSms(req.tenantId, contact.phone, body);
  }

  if (!contact.email) return { ok: false, error: "No email address on file" };

  /**
   * There is no unsubscribe-link route yet, so there is no URL to put in the
   * footer — and a marketing email without a functional unsubscribe is unlawful.
   * This refuses deliberately, as a COMPLIANCE guard, not as a transport stub:
   * B6 wires SES, and wiring a transport must not be able to turn this into a
   * silent breach. Build the unsubscribe route first.
   */
  return {
    ok: false,
    error:
      "Marketing email cannot be sent yet: there is no unsubscribe link to include, and a marketing email without a functional unsubscribe breaches the Spam Act. Nothing was sent. (B6 must build the unsubscribe route, not only wire SES.)",
  };
}

/* ------------------------------------------------------------------ SMS */

/**
 * MessageMedia (Sinch), the APAC instance.
 *
 * Two things about Australian SMS that are easy to get wrong and expensive to
 * discover later:
 *
 * 1. An ALPHANUMERIC sender id ("OziRealty") is ONE-WAY. It cannot receive
 *    replies — which means it cannot receive STOP. A marketing SMS whose only
 *    unsubscribe route is "reply STOP" to a number that cannot hear it does not
 *    have a functional unsubscribe, and the Spam Act requires one. So marketing
 *    sends refuse an alphanumeric sender outright, below, rather than producing
 *    messages that look compliant and are not.
 *
 * 2. MessageMedia maintains its own opt-out blacklist and enforces it on send,
 *    returning DLR status 302 rather than an error. A suppressed message looks
 *    successful at the API boundary, so the delivery-receipt webhook is where
 *    that truth arrives — see the DLR route.
 */
async function sendSms(
  tenantId: string,
  toE164: string,
  body: string,
): Promise<SendResult> {
  const key = await getSecret(tenantId, "MESSAGEMEDIA_KEY");
  const secret = await getSecret(tenantId, "MESSAGEMEDIA_SECRET");
  if (!key || !secret) {
    return {
      ok: false,
      error: "No MessageMedia credentials. Add them in Settings → Credentials.",
    };
  }

  const sourceNumber = process.env.MESSAGEMEDIA_SOURCE_NUMBER;
  const sourceType = (process.env.MESSAGEMEDIA_SOURCE_TYPE ?? "INTERNATIONAL").toUpperCase();

  if (sourceType === "ALPHANUMERIC") {
    return {
      ok: false,
      error:
        "The configured sender ID is alphanumeric, which cannot receive replies — so 'Reply STOP' would not work and the message would have no functional unsubscribe. Configure a dedicated virtual number for marketing SMS.",
    };
  }

  const auth = Buffer.from(`${key}:${secret}`).toString("base64");
  let res: Response;
  try {
    res = await fetch("https://api.messagemedia.com/v1/messages", {
      method: "POST",
      headers: {
        authorization: `Basic ${auth}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        messages: [
          {
            content: body,
            destination_number: toE164,
            ...(sourceNumber
              ? { source_number: sourceNumber, source_number_type: sourceType }
              : {}),
            format: "SMS",
            // Ask for delivery receipts: without them a suppressed (302) message
            // is indistinguishable from a delivered one.
            delivery_report: true,
          },
        ],
      }),
    });
  } catch (e) {
    return { ok: false, error: `Network error: ${e instanceof Error ? e.message : e}` };
  }

  // 202 Accepted, not 200 — treating only 200 as success silently fails every send.
  if (res.status !== 202) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    return { ok: false, error: `MessageMedia ${res.status}: ${detail}` };
  }

  const data = (await res.json()) as { messages?: { message_id?: string }[] };
  return {
    ok: true,
    providerMessageId: data.messages?.[0]?.message_id ?? null,
    sentBody: body,
  };
}

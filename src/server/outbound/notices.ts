import { and, eq } from "drizzle-orm";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { withTenant } from "@/db";
import { contacts, interactions } from "@/db/schema";
import { env } from "@/env";
import { SOCIALS } from "@/components/public/agency";

/**
 * Automatic notices for a new website enquiry (owner's request, 2026-11-03).
 *
 *   1. An alert to the agency's inbox (NOTIFY_TO) with the enquiry in full.
 *   2. A fixed "we received your enquiry" reply to the sender.
 *
 * Neither is AI-drafted and neither is marketing: both are fixed templates sent
 * because the person just asked for something, which is why they do not go through
 * the approval queue (§3.1 covers AI drafts). Keep them that way — a promotional line
 * added to the reply turns it into a commercial message that needs consent and an
 * unsubscribe (§10). Plain text only, so nothing the visitor typed can become markup.
 *
 * Idempotent: the reply is recorded as an outbound interaction keyed `ack:<id>`, and a
 * retry that finds it stops. Unset SES_FROM or NOTIFY_TO skips quietly rather than
 * failing, so the form keeps working before SES is set up.
 */

let client: SESv2Client | null = null;

/** The display name every notice is sent under (owner's request, 2026-11-03). */
const FROM_NAME = "Esi Dor | Ozi Realty";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** HTML signature under the receipt. Images are absolute: mail clients cannot resolve paths. */
const SIGNATURE_HTML = `
<table cellpadding="0" cellspacing="0" style="margin-top:24px;border-top:2px solid #D84315;padding-top:16px;font-family:Arial,sans-serif;font-size:13px;color:#13254A">
  <tr>
    <td style="padding-right:16px;vertical-align:top">
      <img src="https://www.ozirealty.com.au/brand/esi-dor.jpg" alt="Esi Dor" width="72" height="72" style="border-radius:50%;display:block">
    </td>
    <td style="vertical-align:top;line-height:1.5">
      <strong style="font-size:15px">Esi Dor</strong><br>
      Director &amp; CEO, Ozi Realty<br>
      <a href="tel:1800400333" style="color:#0034C8;text-decoration:none">1800 400 333</a> &middot;
      <a href="tel:0422271293" style="color:#0034C8;text-decoration:none">0422 271 293</a><br>
      <a href="https://www.ozirealty.com.au" style="color:#0034C8;text-decoration:none">www.ozirealty.com.au</a><br>
      308 Prospect Rd, Prospect SA 5082 &middot; RLA 350628<br>
      ${SOCIALS.map((s) => `<a href="${s.href}" style="color:#D84315;text-decoration:none;font-weight:bold">${s.name}</a>`).join(" &middot; ")}<br>
      <img src="https://www.ozirealty.com.au/brand/logo.png" alt="Ozi Realty" height="36" style="margin-top:8px;display:block">
    </td>
  </tr>
</table>`;

async function sendPlain(
  to: string,
  subject: string,
  body: string,
  replyTo?: string,
  html?: string,
) {
  client ??= new SESv2Client({ region: env.AWS_REGION });
  const res = await client.send(
    new SendEmailCommand({
      // Quoted: "|" is not allowed bare in a display name.
      FromEmailAddress: `"${FROM_NAME}" <${env.SES_FROM}>`,
      Destination: { ToAddresses: [to] },
      ReplyToAddresses: replyTo ? [replyTo] : undefined,
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: {
            Text: { Data: body, Charset: "UTF-8" },
            ...(html ? { Html: { Data: html, Charset: "UTF-8" } } : {}),
          },
        },
      },
    }),
  );
  return res.MessageId ?? null;
}

export async function notifyEnquiry(tenantId: string, interactionId: string) {
  if (!env.SES_FROM) return { skipped: "SES_FROM not set" };

  const loaded = await withTenant(tenantId, async (tx) => {
    const [row] = await tx
      .select({
        contactId: interactions.contactId,
        subject: interactions.subject,
        body: interactions.body,
        occurredAt: interactions.occurredAt,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        email: contacts.emailRaw,
        phone: contacts.phoneE164,
      })
      .from(interactions)
      .innerJoin(contacts, eq(contacts.id, interactions.contactId))
      .where(eq(interactions.id, interactionId))
      .limit(1);
    const [sent] = await tx
      .select({ id: interactions.id })
      .from(interactions)
      .where(and(eq(interactions.tenantId, tenantId), eq(interactions.messageId, `ack:${interactionId}`)))
      .limit(1);
    return { row, alreadySent: Boolean(sent) };
  });

  const { row, alreadySent } = loaded;
  if (!row) return { skipped: "interaction not found" };
  if (alreadySent) return { skipped: "already sent" };

  const name = [row.firstName, row.lastName].filter(Boolean).join(" ") || "Not given";

  if (env.NOTIFY_TO) {
    await sendPlain(
      env.NOTIFY_TO,
      `New ${row.subject ?? "website enquiry"} from ${name}`,
      [
        `Name: ${name}`,
        `Email: ${row.email ?? "Not given"}`,
        `Phone: ${row.phone ?? "Not given"}`,
        `Received: ${row.occurredAt.toLocaleString("en-AU", { timeZone: "Australia/Adelaide" })}`,
        "",
        row.body?.trim() || "(no message)",
        "",
        "Open the contact in the CRM: https://app.ozirealty.com.au/contacts/" + row.contactId,
      ].join("\n"),
      row.email ?? undefined,
    );
  }

  // Every form alerts the agency; the free-book form gets no receipt (owner's request,
  // 2026-11-03). Its subject is "Website enquiry — Gift Party bundle" (web-form adapter).
  const noReceipt = row.subject?.endsWith("Gift Party bundle") ?? false;
  if (!row.email || noReceipt) return { alerted: Boolean(env.NOTIFY_TO), acknowledged: false };

  // Wording is the owner's, verbatim (2026-11-03).
  const first = row.firstName?.trim() || "there";
  const subject = `Thanks for getting in touch, ${first}`;
  const body = [
    `Hi ${first},`,
    "",
    "Thanks for reaching out to Ozi Realty. We’ve received your details and we’ll personally follow up with you within one business day.",
    "",
    "In the meantime, if your enquiry is time-sensitive, you’re welcome to call us on 1800 400 333 or 0422 271 293.",
    "",
    "Looking forward to helping you with your property goals.",
    "",
    "Warm regards,",
    "",
    "Esi Dor",
    "Director & CEO, Ozi Realty",
    "308 Prospect Rd, Prospect SA 5082",
    "RLA 350628",
    ...SOCIALS.map((s) => `${s.name}: ${s.href}`),
  ].join("\n");

  // HTML twin: the same paragraphs up to "Warm regards," then the graphic signature.
  const paras = body.split("\n\n").slice(0, 5);
  const html =
    `<div style="font-family:Arial,sans-serif;font-size:14px;color:#13254A;line-height:1.6">` +
    paras.map((p) => `<p>${esc(p)}</p>`).join("") +
    SIGNATURE_HTML +
    `</div>`;

  const providerId = await sendPlain(row.email, subject, body, env.NOTIFY_TO, html);

  // The reply goes on the contact's record like any other touch (§4), and doubles as
  // the idempotency marker.
  await withTenant(tenantId, (tx) =>
    tx
      .insert(interactions)
      .values({
        tenantId,
        contactId: row.contactId,
        channel: "email",
        direction: "out",
        occurredAt: new Date(),
        subject,
        body,
        messageId: `ack:${interactionId}`,
        threadRef: providerId,
      })
      .onConflictDoNothing(),
  );

  return { alerted: Boolean(env.NOTIFY_TO), acknowledged: true };
}

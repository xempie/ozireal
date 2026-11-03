import { and, eq } from "drizzle-orm";
import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { withTenant } from "@/db";
import { contacts, interactions } from "@/db/schema";
import { env } from "@/env";

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

async function sendPlain(to: string, subject: string, body: string, replyTo?: string) {
  client ??= new SESv2Client({ region: env.AWS_REGION });
  const res = await client.send(
    new SendEmailCommand({
      FromEmailAddress: env.SES_FROM,
      Destination: { ToAddresses: [to] },
      ReplyToAddresses: replyTo ? [replyTo] : undefined,
      Content: {
        Simple: {
          Subject: { Data: subject, Charset: "UTF-8" },
          Body: { Text: { Data: body, Charset: "UTF-8" } },
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

  if (!row.email) return { alerted: Boolean(env.NOTIFY_TO), acknowledged: false };

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
  ].join("\n");

  const providerId = await sendPlain(row.email, subject, body, env.NOTIFY_TO);

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

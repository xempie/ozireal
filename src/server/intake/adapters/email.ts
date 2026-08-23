import { simpleParser, type AddressObject } from "mailparser";
import { z } from "zod";
import type { ChannelAdapter, NormalisedInteraction } from "../types";

/**
 * Inbound email (B3.5).
 *
 * The AWS delivery chain is: MX on in.ozirealty.com.au → SES receipt rule (verified
 * available in ap-southeast-2, docs/research) → raw MIME to S3 → SNS → the Route
 * Handler → this adapter. The adapter's contract starts at "here is the raw MIME
 * and where it is stored" — everything AWS-shaped (SNS signature verification, S3
 * fetch) lives in the route, so tests can feed captured MIME straight in and the
 * adapter neither knows nor cares that AWS exists.
 */

export const emailIngestInput = z.object({
  /** The full raw MIME message. */
  mime: z.string().min(1),
  /** Where the original was preserved. The parsed row is a convenience; the S3
   *  object is the evidence (§4: the record needs evidence, not just our summary). */
  rawS3Key: z.string().nullable().default(null),
});

function first(a: AddressObject | AddressObject[] | undefined) {
  const obj = Array.isArray(a) ? a[0] : a;
  return obj?.value?.[0];
}

/** 'Jane Citizen' → {Jane, Citizen}; 'Jane' → {Jane, null}; '' → nulls.
 *  RFC 2822 display names arrive quoted ('"Jane Citizen"') — strip the surrounding
 *  quotes only. Characters INSIDE a name stay: O'Brien's apostrophe is the name. */
export function splitDisplayName(name: string | undefined | null): {
  firstName: string | null;
  lastName: string | null;
} {
  const clean = (name ?? "").trim().replace(/^["']+|["']+$/g, "").trim();
  if (!clean) return { firstName: null, lastName: null };
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
}

export const emailAdapter: ChannelAdapter = {
  id: "email",
  canReply: true,

  async ingest(raw: unknown): Promise<NormalisedInteraction> {
    const input = emailIngestInput.parse(raw);
    const mail = await simpleParser(input.mime);

    const from = first(mail.from);
    const { firstName, lastName } = splitDisplayName(from?.name);

    /**
     * Threading: RFC 5322 In-Reply-To names the direct parent; References carries
     * the whole chain, oldest first. The ROOT of the chain is the thread key, so
     * every reply in one conversation shares one threadRef regardless of depth.
     */
    const references = mail.references
      ? Array.isArray(mail.references)
        ? mail.references
        : [mail.references]
      : [];
    const threadRef = references[0] ?? mail.inReplyTo ?? mail.messageId ?? null;

    const body = (mail.text ?? htmlToText(mail.html || "")).trim();

    return {
      channel: "email",
      direction: "in",
      occurredAt: mail.date ?? new Date(),
      subject: mail.subject?.trim() || null,
      // An empty body still happened — attachments-only mail is real mail.
      body: body || "(no text body)",
      identity: {
        kind: "claimed",
        email: from?.address ?? null,
        phone: null,
        firstName,
        lastName,
      },
      messageId: mail.messageId ?? null,
      threadRef,
      rawS3Key: input.rawS3Key,
      listingRef: null,
      consents: [],
    };
  },
};

/** Last-resort text extraction for HTML-only mail. mailparser's `text` is preferred;
 *  this exists so an HTML-only message never ingests as an empty body. */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

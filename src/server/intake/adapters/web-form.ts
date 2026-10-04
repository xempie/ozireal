import { z } from "zod";
import type { ChannelAdapter, NormalisedInteraction } from "../types";
import { rolesForSubmission } from "../form-roles";
import {
  EMAIL_MESSAGE,
  PHONE_MESSAGE,
  isValidEmail,
  isValidPhone,
} from "@/components/public/forms/validate";

/**
 * The website enquiry form (B3.4) — the wire format half. The Route Handler owns
 * transport concerns (key lookup, spam guards, rate limits, IP derivation); by the
 * time a payload reaches ingest() it has earned the right to be treated as an
 * enquiry. Validation here is the LAST line, not the only one.
 */

export const webFormPayload = z
  .object({
    firstName: z.string().trim().max(200).default(""),
    lastName: z.string().trim().max(200).default(""),
    email: z
      .string()
      .trim()
      .max(320)
      .default("")
      .refine((v) => v === "" || isValidEmail(v), EMAIL_MESSAGE),
    phone: z
      .string()
      .trim()
      .max(32)
      .default("")
      .refine((v) => v === "" || isValidPhone(v), PHONE_MESSAGE),
    message: z.string().trim().min(1, "An empty enquiry is not an enquiry").max(5000),
    /** Which property/listing the form was about, when it was on a listing page. */
    listingRef: z.string().trim().max(120).nullable().default(null),
    formName: z.string().trim().min(1).max(120),
    /** Ticked the marketing-consent box. Absent box ≠ consent (Spam Act). */
    marketingOptIn: z.boolean().default(false),
    /** Captured by the route: the wording that was on screen, and where from. */
    consentWording: z.string().max(2000).default(""),
    ipAddress: z.string().max(64).nullable().default(null),
    /** The signed token's nonce — doubles as the replay-dedupe message id. */
    nonce: z.string().min(8).max(128),
    submittedAt: z.coerce.date(),
  })
  .strict();

export type WebFormPayload = z.infer<typeof webFormPayload>;

export const webFormAdapter: ChannelAdapter = {
  id: "web_form",
  canReply: false,

  async ingest(raw: unknown): Promise<NormalisedInteraction> {
    const p = webFormPayload.parse(raw);

    /**
     * Consent is recorded ONLY when the box was ticked and the wording that was on
     * screen travelled with the submission. A tick with no wording is worthless as
     * evidence, so it is not recorded as consent — that is honest, and honesty here
     * is the whole point of the consents table.
     */
    const consents: NormalisedInteraction["consents"] =
      p.marketingOptIn && p.consentWording && p.email
        ? [
            {
              channel: "email",
              status: "granted",
              sourceForm: p.formName,
              wordingShown: p.consentWording,
              ipAddress: p.ipAddress,
            },
          ]
        : [];

    return {
      channel: "web_form",
      direction: "in",
      occurredAt: p.submittedAt,
      subject: p.listingRef
        ? `Website enquiry — ${p.listingRef}`
        : `Website enquiry — ${p.formName}`,
      body: p.message,
      identity: {
        kind: "claimed",
        email: p.email || null,
        phone: p.phone || null,
        firstName: p.firstName || null,
        lastName: p.lastName || null,
      },
      messageId: `form:${p.nonce}`,
      threadRef: null,
      rawS3Key: null,
      listingRef: p.listingRef,
      consents,
      roles: rolesForSubmission(p.formName, p.message),
    };
  },
};

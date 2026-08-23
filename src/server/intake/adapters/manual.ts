import { z } from "zod";
import type { ChannelAdapter, NormalisedInteraction } from "../types";

/**
 * Manual entry — the §5 adapter for a human typing up a call or a doorknock.
 *
 * It exists so that hand-entered history rides the SAME pipeline as everything
 * else: same interactions row, same enqueued summarise/rebuild jobs, same
 * append-only guarantees. The one honest difference: the human is standing on the
 * contact's screen, so identity arrives resolved and no message id exists — two
 * phone calls are two interactions, never a replay.
 */

export const manualEntry = z.object({
  contactId: z.string().uuid(),
  channel: z.enum(["phone", "sms", "manual", "social"]).default("manual"),
  direction: z.enum(["in", "out"]).default("in"),
  subject: z.string().trim().max(200).nullable().default(null),
  body: z.string().trim().min(1).max(4000),
  occurredAt: z.coerce.date().optional(),
});

export const manualAdapter: ChannelAdapter = {
  id: "manual",
  canReply: false,

  async ingest(raw: unknown): Promise<NormalisedInteraction> {
    const p = manualEntry.parse(raw);
    return {
      channel: p.channel,
      direction: p.direction,
      occurredAt: p.occurredAt ?? new Date(),
      subject: p.subject,
      body: p.body,
      identity: { kind: "resolved", contactId: p.contactId },
      messageId: null,
      threadRef: null,
      rawS3Key: null,
      listingRef: null,
      consents: [],
    };
  },
};

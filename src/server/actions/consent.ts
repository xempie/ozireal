"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { defineAction, ActionError } from "./action";
import { contacts, consents } from "@/db/schema";

/**
 * Consent recorded by hand (approved 2026-09-26), for contacts who did not come in
 * through a web form: other agents, people met in person, referrals.
 *
 * The Spam Act defence is provenance, so a manual row carries the same things a form
 * row does, as honestly as a manual entry can:
 *
 *   source_form   — how it was given and who recorded it ("Manual: phone call,
 *                   recorded by Sam Wilson"). Never passes itself off as a form.
 *   wording_shown — what the person agreed to, in the agent's words. Required for a
 *                   grant, because "they said yes" to nothing in particular is not
 *                   consent to anything in particular.
 *   occurred_at   — when they gave it, which is not when it was typed in.
 *
 * Append-only like every consent row (migration 0001): a withdrawal is a new row with
 * status revoked, and the latest row per channel is the current state the send gate
 * reads. Nothing here can edit or delete history.
 */

const METHODS = {
  phone_call: "phone call",
  email: "email",
  sms: "SMS",
  in_person: "in person",
  in_writing: "in writing",
} as const;

export const recordConsent = defineAction({
  input: z.object({
    contactId: z.string().uuid(),
    channel: z.enum(["sms", "email", "phone"]),
    status: z.enum(["granted", "revoked"]),
    method: z.enum(["phone_call", "email", "sms", "in_person", "in_writing"]),
    /** When they gave it. Defaults to now; never in the future. */
    occurredAt: z.coerce.date().optional(),
    wording: z.string().trim().max(1000).optional(),
  }),
  async handler(input, ctx) {
    /*
      Checked here rather than as a .refine() on the schema: Next.js treats a plain
      function at the top level of a "use server" file as a would-be Server Action and
      refuses the build.
    */
    if (input.status === "granted" && (input.wording?.length ?? 0) < 10) {
      throw new ActionError(
        "Say what they agreed to, e.g. 'SMS updates about new listings in the eastern suburbs'.",
      );
    }
    const occurredAt = input.occurredAt ?? new Date();
    if (occurredAt.getTime() > Date.now() + 5 * 60_000) {
      throw new ActionError("Consent cannot be dated in the future.");
    }

    const [c] = await ctx.tx
      .select({
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        tombstonedAt: contacts.tombstonedAt,
        mergedIntoId: contacts.mergedIntoId,
      })
      .from(contacts)
      .where(eq(contacts.id, input.contactId))
      .limit(1);
    if (!c) throw new ActionError("That contact no longer exists.");
    if (c.mergedIntoId) throw new ActionError("That record was merged. Record consent on the surviving record.");
    if (c.tombstonedAt) throw new ActionError("That contact asked to be removed. Consent cannot be recorded.");

    const channelLabel = input.channel === "sms" ? "SMS" : input.channel;
    const [row] = await ctx.tx
      .insert(consents)
      .values({
        tenantId: ctx.tenantId,
        contactId: input.contactId,
        channel: input.channel,
        status: input.status,
        sourceForm: `Manual: ${METHODS[input.method]}, recorded by ${ctx.userName}`,
        wordingShown:
          input.wording?.trim() ||
          `Asked not to be contacted by ${channelLabel} (${METHODS[input.method]}).`,
        ipAddress: null,
        occurredAt,
      })
      .returning({ id: consents.id });

    await ctx.audit({
      kind: "commit",
      action: `${input.status === "granted" ? "Recorded" : "Withdrew"} ${channelLabel} consent by hand`,
      target: `${c.firstName} ${c.lastName}`,
      entityType: "consent",
      entityId: row.id,
      metadata: { method: input.method, occurredAt },
    });

    revalidatePath(`/contacts/${input.contactId}`);
    revalidatePath("/contacts");
    return { id: row.id };
  },
});

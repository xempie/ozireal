"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { defineAction, ActionError } from "./action";
import { approvalItems, contacts } from "@/db/schema";
import { checkConsent } from "@/server/outbound/gate";

/**
 * A one-off message draft into the approval queue.
 *
 * This is as far as any drafted message goes (rule 1): a pending approval item. The
 * person reviews, edits and sends it on the Approvals screen, where the consent gate runs
 * AGAIN at the instant of sending (rule 2) — the check here only stops a draft that would
 * certainly be refused from being written at all.
 */
export const createMessageDraft = defineAction({
  input: z.object({
    contactId: z.string().uuid(),
    channel: z.enum(["sms", "email"]),
    subject: z.string().trim().max(200).optional(),
    body: z.string().trim().min(1, "The message is empty.").max(4000),
    listingId: z.string().uuid().optional(),
  }),
  async handler(input, ctx) {
    const [c] = await ctx.tx
      .select({ firstName: contacts.firstName, lastName: contacts.lastName })
      .from(contacts)
      .where(eq(contacts.id, input.contactId))
      .limit(1);
    if (!c) throw new ActionError("That contact no longer exists.");

    const gate = await checkConsent(ctx.tx, input.contactId, input.channel);
    if (!gate.allowed) {
      throw new ActionError(`Not drafted: ${gate.reason}`);
    }

    const [item] = await ctx.tx
      .insert(approvalItems)
      .values({
        tenantId: ctx.tenantId,
        kind: input.channel,
        status: "pending",
        contactId: input.contactId,
        listingId: input.listingId ?? null,
        draftSubject: input.channel === "email" ? (input.subject ?? null) : null,
        draftBody: input.body,
        consentAtDraft: gate.consentStatus,
        consentCheckedAt: new Date(),
      })
      .returning({ id: approvalItems.id });

    await ctx.audit({
      kind: "edit",
      action: `Drafted ${input.channel === "sms" ? "an SMS" : "an email"} for approval`,
      target: `${c.firstName} ${c.lastName}`,
      entityType: "approval_item",
      entityId: item.id,
    });

    revalidatePath("/approvals");
    revalidatePath("/dashboard");
    return { id: item.id };
  },
});

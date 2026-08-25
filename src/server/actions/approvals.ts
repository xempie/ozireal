"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { defineAction, ActionError } from "./action";
import { approvalItems, interactions, tenants } from "@/db/schema";
import { checkConsent } from "@/server/outbound/gate";
import { sendMessage } from "@/server/outbound/send";

/**
 * The approval queue (B5.4) and the send gate (B5.5).
 *
 * Rule 1: nothing leaves the building without a human pressing approve. There is
 * no code path here that sends without a reviewer id on the row, and there is no
 * setting that creates one.
 *
 * Rule 2: consent is re-checked INSIDE the send, at the instant of sending — not
 * here at approval time, and not at draft time. Approving is a person saying "the
 * words are right"; the gate is the system saying "and it is still lawful". They
 * are different questions asked at different moments, and conflating them is how
 * an agency sends to someone who unsubscribed on Wednesday.
 */

export const editDraft = defineAction({
  input: z.object({
    id: z.string().uuid(),
    subject: z.string().trim().max(200).optional(),
    body: z.string().trim().min(1, "A message needs a body").max(4000),
  }),
  async handler(input, ctx) {
    const [item] = await ctx.tx
      .select()
      .from(approvalItems)
      .where(eq(approvalItems.id, input.id))
      .limit(1);
    if (!item) throw new ActionError("That draft is no longer in the queue.");
    if (item.status !== "pending") {
      throw new ActionError("That item was already handled and cannot be edited.");
    }

    await ctx.tx
      .update(approvalItems)
      .set({
        draftSubject: input.subject ?? item.draftSubject,
        draftBody: input.body,
        // Keep the AI's original the FIRST time a human edits, so the audit shows
        // what changed. Overwriting it on a second edit would erase that.
        originalBody: item.originalBody ?? item.draftBody,
      })
      .where(eq(approvalItems.id, input.id));

    await ctx.audit({
      kind: "edit",
      action: "Edited a draft before approval",
      target: input.subject ?? input.body.slice(0, 60),
      entityType: "approval_item",
      entityId: input.id,
    });

    revalidatePath("/approvals");
    return { id: input.id };
  },
});

export const rejectDraft = defineAction({
  input: z.object({
    id: z.string().uuid(),
    // The database constraint requires a reason on a rejected row; asking for it
    // here means the person gives one, rather than the system inventing one.
    reason: z.string().trim().min(3, "Say why, so the next draft is better").max(300),
  }),
  async handler(input, ctx) {
    const [item] = await ctx.tx
      .select({ status: approvalItems.status, subject: approvalItems.draftSubject })
      .from(approvalItems)
      .where(eq(approvalItems.id, input.id))
      .limit(1);
    if (!item) throw new ActionError("That draft is no longer in the queue.");
    if (item.status !== "pending") throw new ActionError("That item was already handled.");

    await ctx.tx
      .update(approvalItems)
      .set({
        status: "rejected",
        rejectReason: input.reason,
        reviewedByUserId: ctx.userId,
        reviewedAt: new Date(),
      })
      .where(eq(approvalItems.id, input.id));

    await ctx.audit({
      kind: "reject",
      action: "Rejected a draft",
      target: item.subject ?? input.id.slice(0, 8),
      entityType: "approval_item",
      entityId: input.id,
      metadata: { reason: input.reason },
    });

    revalidatePath("/approvals");
    return { rejected: true };
  },
});

/**
 * Approve and send.
 *
 * The two are one action on purpose. An "approved but not yet sent" state invites
 * a background job to do the sending later, and the moment that exists, rule 1 is
 * decorative — the human approved a message that a machine sent at a time nobody
 * chose, against consent nobody re-checked.
 */
export const approveAndSend = defineAction({
  input: z.object({ id: z.string().uuid() }),
  async handler(input, ctx) {
    /**
     * Claim the row FOR UPDATE and flip it out of `pending` in the same statement.
     *
     * Two people (or two clicks) hitting approve together both read `pending`,
     * both passed the gate, and both sent — the same message twice, to someone who
     * agreed to receive it once. The conditional update makes the claim atomic:
     * exactly one caller can move a row out of pending, and the loser is told the
     * item was already handled. Found by the B5 review.
     *
     * "approved" is the transient claim: it means a human has decided but the
     * wire has not answered yet. It is never a resting state — every path below
     * moves it to sent, blocked, or back to pending.
     */
    const [claimed] = await ctx.tx
      .update(approvalItems)
      .set({ status: "approved", reviewedByUserId: ctx.userId, reviewedAt: new Date() })
      .where(and(eq(approvalItems.id, input.id), eq(approvalItems.status, "pending")))
      .returning();

    if (!claimed) {
      const [existing] = await ctx.tx
        .select({ id: approvalItems.id })
        .from(approvalItems)
        .where(eq(approvalItems.id, input.id))
        .limit(1);
      throw new ActionError(
        existing
          ? "That item was already handled."
          : "That draft is no longer in the queue.",
      );
    }
    const item = claimed;
    if (!item.contactId) {
      throw new ActionError("That draft has no recipient and cannot be sent.");
    }

    /**
     * Only the two messaging kinds have a consent gate to pass. A social post or
     * an article is not addressed to a person, so "may we contact them" is not a
     * question that applies — and silently treating one as email would send it.
     */
    if (item.kind !== "email" && item.kind !== "sms") {
      throw new ActionError(
        `A ${item.kind} item is not a direct message and is not sent from this queue.`,
      );
    }
    const channel = item.kind;

    /**
     * THE GATE. Re-checked here, milliseconds before the send, whatever the draft
     * recorded on Monday.
     */
    const decision = await checkConsent(ctx.tx, item.contactId, channel);

    if (!decision.allowed) {
      await ctx.tx
        .update(approvalItems)
        .set({
          status: "blocked",
          blockReason: decision.reason,
          consentCheckedAt: new Date(),
          reviewedByUserId: ctx.userId,
          reviewedAt: new Date(),
        })
        .where(eq(approvalItems.id, input.id));

      /**
       * A refusal is audited as a first-class event with actor "system". A blocked
       * send is evidence that the gate worked, and it is exactly what an agency
       * would want to produce if a complaint ever arrived.
       */
      await ctx.audit({
        kind: "block",
        action: "Refused a send at the consent gate",
        target: item.draftSubject ?? item.draftBody.slice(0, 60),
        entityType: "approval_item",
        entityId: input.id,
        metadata: { reason: decision.reason, channel },
      });

      /**
       * Deliberately NO revalidatePath on this branch — not even for another route.
       *
       * revalidatePath inside a Server Action invalidates the client router cache
       * and refreshes the CURRENT route whichever path is named. That re-renders
       * /approvals, the item stops being pending, and the control that was about to
       * explain the refusal unmounts — so the person who pressed send watches the
       * card move and never learns why. The row and the audit are already durable;
       * the screen catches up when they acknowledge it, and /compliance is
       * force-dynamic so it re-reads on its next visit regardless.
       */
      // Not an error: the system did the right thing. The UI renders the reason.
      return { sent: false as const, blocked: true as const, reason: decision.reason };
    }

    const [agency] = await ctx.tx
      .select({ name: tenants.name, licence: tenants.licenceNumber })
      .from(tenants)
      .where(eq(tenants.id, ctx.tenantId))
      .limit(1);

    /**
     * KNOWN GAP, stated rather than hidden.
     *
     * This HTTP call happens inside the action's database transaction. The claim
     * above closes the common double-send (two clicks, two tabs), but a crash
     * between the provider accepting the message and this transaction committing
     * would roll the row back to pending while the SMS is already gone — so a
     * retry could send it twice.
     *
     * Closing it properly means splitting approve-and-send into two committed
     * phases with the wire call in between, which is a real refactor and belongs
     * with B6's transport work rather than being half-done here. Until then the
     * window is seconds wide, the provider id is recorded on success, and a
     * duplicate is detectable rather than invisible. Raised by the B5 review.
     */
    const result = await sendMessage({
      tenantId: ctx.tenantId,
      contactId: item.contactId,
      channel,
      subject: item.draftSubject,
      body: item.draftBody,
      agency: { name: agency.name, licence: agency.licence },
    });

    if (!result.ok) {
      // A provider failure is NOT a block: consent was fine, the wire was not.
      // Leaving it pending lets the person retry rather than losing the draft.
      throw new ActionError(
        `The message was approved but the provider refused it: ${result.error}. Nothing was sent; the draft is still in the queue.`,
      );
    }

    const now = new Date();
    await ctx.tx
      .update(approvalItems)
      .set({
        status: "sent",
        sentAt: now,
        /**
         * Left as it was. Writing "granted" when the draft never recorded a
         * consent state invents provenance — and this column exists precisely so
         * the screen can say "changed since drafting" truthfully. A null means
         * "we did not check at draft time", which is the fact.
         */
        consentAtDraft: item.consentAtDraft,
        consentCheckedAt: now,
        reviewedByUserId: ctx.userId,
        reviewedAt: now,
        providerMessageId: result.providerMessageId ?? null,
      })
      .where(eq(approvalItems.id, input.id));

    /**
     * A sent message is an interaction. Recording it here means the contact's log
     * shows what the agency said as well as what the contact said — without it,
     * the rolling brief reads one half of a conversation.
     */
    await ctx.tx.insert(interactions).values({
      tenantId: ctx.tenantId,
      contactId: item.contactId,
      channel,
      direction: "out",
      occurredAt: now,
      subject: item.draftSubject,
      body: result.sentBody,
      messageId: result.providerMessageId ?? null,
      createdByUserId: ctx.userId,
    });

    await ctx.audit({
      kind: "approve",
      action: `Approved and sent a ${channel} message`,
      target: item.draftSubject ?? item.draftBody.slice(0, 60),
      entityType: "approval_item",
      entityId: input.id,
      metadata: {
        consentGrantedAt: decision.grantedAt.toISOString(),
        // The wording they agreed to, frozen into the audit of the send it justified.
        consentWording: decision.wording,
        providerMessageId: result.providerMessageId,
      },
    });

    revalidatePath("/approvals");
    revalidatePath(`/contacts/${item.contactId}`);
    return { sent: true as const, blocked: false as const, providerMessageId: result.providerMessageId };
  },
});

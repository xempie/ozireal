"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { defineAction, ActionError } from "./action";
import { approvalItems, campaignRecipients, campaigns, listings, matches, properties, suburbs } from "@/db/schema";
import { enqueue } from "@/server/jobs/queues";

/**
 * Matched-buyer emails (2026-11-12): from the Matching board, start a batch of personal
 * emails about ONE property to the people the agent ticked.
 *
 * This only creates the campaign and queues one draft per person. Every draft lands in
 * the approval queue; the agent approves them (one by one, or the whole batch); the send
 * gate re-checks consent at the instant of each send (rules 1 and 2). There is no path
 * from here to a send.
 */
export const startMatchEmails = defineAction({
  input: z.object({
    propertyId: z.string().uuid(),
    contactIds: z.array(z.string().uuid()).min(1, "Tick at least one person").max(200),
  }),
  async handler(input, ctx) {
    const [p] = await ctx.tx
      .select({
        id: properties.id,
        street: sql<string>`trim(coalesce(${properties.unit} || '/', '') || coalesce(${properties.streetNumber} || ' ', '') || coalesce(${properties.street}, ''))`,
        suburb: suburbs.name,
      })
      .from(properties)
      .leftJoin(suburbs, eq(suburbs.id, properties.suburbId))
      .where(eq(properties.id, input.propertyId))
      .limit(1);
    if (!p) throw new ActionError("That property no longer exists.");

    // Only people this property was actually matched with: the board cannot be used to
    // email an arbitrary list.
    const matched = await ctx.tx
      .select({ contactId: matches.contactId })
      .from(matches)
      .where(and(eq(matches.propertyId, p.id), inArray(matches.contactId, input.contactIds)));
    const ids = [...new Set(matched.map((m) => m.contactId))];
    if (!ids.length) throw new ActionError("None of those people are matched with this property.");

    // The campaign it is about: the live listing if there is one, else the newest draft.
    const [l] = await ctx.tx
      .select({ id: listings.id })
      .from(listings)
      .where(and(eq(listings.propertyId, p.id), inArray(listings.status, ["live", "under_offer", "draft"])))
      .orderBy(sql`case ${listings.status} when 'live' then 0 when 'under_offer' then 1 else 2 end`, desc(listings.createdAt))
      .limit(1);

    const label = `${p.street}${p.suburb ? `, ${p.suburb}` : ""}`;
    const [c] = await ctx.tx
      .insert(campaigns)
      .values({
        tenantId: ctx.tenantId,
        name: `Matched buyers: ${label}`,
        channel: "email",
        status: "draft",
        propertyId: p.id,
        listingId: l?.id ?? null,
        segment: { kind: "matches", propertyId: p.id, contactIds: ids },
        createdByUserId: ctx.userId,
      })
      .returning({ id: campaigns.id });

    const recipients = await ctx.tx
      .insert(campaignRecipients)
      .values(ids.map((contactId) => ({ tenantId: ctx.tenantId, campaignId: c.id, contactId })))
      .returning({ id: campaignRecipients.id });

    await ctx.audit({
      kind: "edit",
      action: `Started personal emails to ${ids.length} matched ${ids.length === 1 ? "person" : "people"}`,
      target: label,
      entityType: "campaign",
      entityId: c.id,
    });

    ctx.afterCommit(async () => {
      for (const r of recipients) await enqueue("DraftMatchEmail", { tenantId: ctx.tenantId, entityId: r.id });
    });
    revalidatePath("/matching");
    return { campaignId: c.id, count: ids.length };
  },
});

/** Draft again for anyone whose draft failed or was removed, without duplicating. */
export const redraftMatchEmails = defineAction({
  input: z.object({ campaignId: z.string().uuid() }),
  async handler(input, ctx) {
    const rows = await ctx.tx
      .select({ id: campaignRecipients.id, itemId: campaignRecipients.approvalItemId, status: approvalItems.status })
      .from(campaignRecipients)
      .leftJoin(approvalItems, eq(approvalItems.id, campaignRecipients.approvalItemId))
      .where(and(eq(campaignRecipients.campaignId, input.campaignId), sql`${campaignRecipients.sentAt} is null`));
    const redo = rows.filter((r) => !r.itemId || r.status === "rejected");
    for (const r of redo) {
      await ctx.tx
        .update(campaignRecipients)
        .set({ approvalItemId: null, blockedReason: null })
        .where(eq(campaignRecipients.id, r.id));
    }
    ctx.afterCommit(async () => {
      for (const r of redo) await enqueue("DraftMatchEmail", { tenantId: ctx.tenantId, entityId: r.id });
    });
    revalidatePath("/matching");
    return { count: redo.length };
  },
});

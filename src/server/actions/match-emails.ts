"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { defineAction, ActionError } from "./action";
import { approvalItems, audienceRuns, campaignRecipients, campaigns, listings, matches, properties, suburbs } from "@/db/schema";
import { runTask } from "@/server/ai/run-task";
import { loadPrompt } from "@/server/ai/prompts";
import { clientProfiles, propertyProfile } from "@/server/audience/profile";
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
    const matchedIds = [...new Set(matched.map((m) => m.contactId))];
    if (!matchedIds.length) throw new ActionError("None of those people are matched with this property.");
    // At most one of these emails per person per week (owner's rule, 2026-11-13).
    const recent = await ctx.tx
      .select({ contactId: approvalItems.contactId })
      .from(approvalItems)
      .where(
        and(
          inArray(approvalItems.contactId, matchedIds),
          eq(approvalItems.kind, "email"),
          sql`(${approvalItems.status} = 'sent' and ${approvalItems.sentAt} > now() - interval '7 days')
              or ${approvalItems.status} = 'pending'`,
        ),
      );
    const held = new Set(recent.map((r) => r.contactId));
    const ids = matchedIds.filter((id) => !held.has(id));
    if (!ids.length) throw new ActionError("Everyone ticked was emailed in the last 7 days or already has an email waiting.");

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
    return { campaignId: c.id, count: ids.length, held: held.size };
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

/* ------------------------------------------------- AI audience (2026-11-13) */

/** Ask the AI to read every client and pick who suits this property. */
export const findAudienceFor = defineAction({
  input: z.object({ propertyId: z.string().uuid() }),
  async handler(input, ctx) {
    const [busy] = await ctx.tx
      .select({ id: audienceRuns.id })
      .from(audienceRuns)
      .where(and(eq(audienceRuns.propertyId, input.propertyId), inArray(audienceRuns.status, ["queued", "running"])))
      .limit(1);
    if (busy) {
      // A run older than 5 minutes is dead: retire it and start fresh.
      await ctx.tx.update(audienceRuns).set({ status: "failed", error: "Timed out" }).where(and(eq(audienceRuns.id, busy.id), sql`${audienceRuns.createdAt} < now() - interval '5 minutes'`));
      const [still] = await ctx.tx.select({ s: audienceRuns.status }).from(audienceRuns).where(eq(audienceRuns.id, busy.id));
      if (still?.s !== "failed") return { runId: busy.id };
    }
    const [run] = await ctx.tx
      .insert(audienceRuns)
      .values({ tenantId: ctx.tenantId, propertyId: input.propertyId })
      .returning({ id: audienceRuns.id });
    ctx.afterCommit(() => enqueue("FindAudience", { tenantId: ctx.tenantId, entityId: run.id }));
    revalidatePath("/matching");
    return { runId: run.id };
  },
});

const rewriteOut = z.object({
  subject: z.preprocess((v) => String(v ?? "").slice(0, 120), z.string().min(3)),
  body: z.preprocess((v) => String(v ?? "").slice(0, 3000), z.string().min(20)),
});

/**
 * Rewrite one pending draft with AI, following the agent's instruction ("shorter",
 * "mention the stamp duty waiver"). Same facts and rules as the first draft; the result
 * replaces the draft, the AI's first version is kept as the original.
 */
export const aiRewriteDraft = defineAction({
  input: z.object({ id: z.string().uuid(), instruction: z.string().trim().min(2, "Say how to change it").max(500) }),
  async handler(input, ctx) {
    const [item] = await ctx.tx
      .select({
        status: approvalItems.status,
        contactId: approvalItems.contactId,
        subject: approvalItems.draftSubject,
        body: approvalItems.draftBody,
        original: approvalItems.originalBody,
        propertyId: campaigns.propertyId,
      })
      .from(approvalItems)
      .leftJoin(campaigns, eq(campaigns.id, approvalItems.campaignId))
      .where(eq(approvalItems.id, input.id))
      .limit(1);
    if (!item) throw new ActionError("That draft is no longer in the queue.");
    if (item.status !== "pending") throw new ActionError("That email was already handled.");
    const [profile] = item.contactId ? await clientProfiles(ctx.tx, [item.contactId], { enquiries: 6, enquiryChars: 700 }) : [];
    const property = item.propertyId ? await propertyProfile(ctx.tx, item.propertyId) : null;
    const prompt = loadPrompt("match-email.v2");
    const { data } = await runTask(rewriteOut, {
      task: "match-email-rewrite",
      model: "sonnet",
      output: "structured",
      system: [{ text: prompt.text, cache: true }],
      messages: [
        {
          role: "user",
          content: [
            "THE CLIENT",
            profile?.text ?? "(no record)",
            "",
            "THE PROPERTY",
            property?.text ?? "(none)",
            "",
            "THE CURRENT EMAIL",
            `Subject: ${item.subject ?? ""}`,
            item.body,
            "",
            `REWRITE IT, following this instruction from Esi exactly, and every rule above: ${input.instruction}`,
            'Return ONLY {"subject": "...", "body": "..."}.',
          ].join("\n"),
        },
      ],
      maxTokens: 1500,
      tenantId: ctx.tenantId,
      entity: { type: "approval_item", id: input.id },
      promptVersion: prompt.version,
    });
    await ctx.tx
      .update(approvalItems)
      .set({ draftSubject: data.subject, draftBody: data.body, originalBody: item.original ?? item.body, reviewNote: null })
      .where(eq(approvalItems.id, input.id));
    revalidatePath("/matching");
    return data;
  },
});

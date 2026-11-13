import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { withTenant } from "@/db";
import {
  approvalItems,
  campaignRecipients,
  campaigns,
  contacts,
  matches,
} from "@/db/schema";
import { checkConsent } from "@/server/outbound/gate";
import { runTask, TaskOutputError } from "@/server/ai/run-task";
import { ClaudeError } from "@/server/ai/claude";
import { loadPrompt } from "@/server/ai/prompts";
import { clientProfiles, propertyProfile } from "@/server/audience/profile";

/**
 * Draft one matched-buyer email (2026-11-12): the job DraftMatchEmail, one per
 * campaign_recipients row.
 *
 * Reads the person (their wants, their brief, why they matched) and the property (only
 * its public facts and the agent's own price wording), asks the model for a personal
 * email, validates it (runTask + Zod, §9), and files it in the approval queue. Nothing is
 * sent here: the agent approves, and consent is checked again at the send (rules 1, 2).
 *
 * Idempotent: a recipient that already has a draft is skipped.
 */

const draftSchema = z.object({
  subject: z.preprocess((v) => String(v ?? "").slice(0, 120), z.string().min(3)),
  body: z.preprocess((v) => String(v ?? "").slice(0, 3000), z.string().min(20)),
  reviewNote: z.preprocess((v) => (v == null || v === "" ? null : String(v).slice(0, 200)), z.string().nullable()),
});

export async function draftMatchEmail(tenantId: string, recipientId: string) {
  const ctx = await withTenant(tenantId, async (tx) => {
    const [r] = await tx
      .select({
        id: campaignRecipients.id,
        contactId: campaignRecipients.contactId,
        approvalItemId: campaignRecipients.approvalItemId,
        campaignId: campaigns.id,
        propertyId: campaigns.propertyId,
        listingId: campaigns.listingId,
        campaignStatus: campaigns.status,
      })
      .from(campaignRecipients)
      .innerJoin(campaigns, eq(campaigns.id, campaignRecipients.campaignId))
      .where(eq(campaignRecipients.id, recipientId))
      .limit(1);
    if (!r || r.approvalItemId || !r.propertyId || r.campaignStatus === "cancelled") return null;

    const gate = await checkConsent(tx, r.contactId, "email");
    if (!gate.allowed) {
      await tx.update(campaignRecipients).set({ blockedReason: gate.reason }).where(eq(campaignRecipients.id, r.id));
      return null;
    }

    const [person] = await tx
      .select({ firstName: contacts.firstName, lastName: contacts.lastName, email: contacts.emailRaw })
      .from(contacts)
      .where(eq(contacts.id, r.contactId))
      .limit(1);
    if (!person?.email) {
      await tx.update(campaignRecipients).set({ blockedReason: "No email address on file." }).where(eq(campaignRecipients.id, r.id));
      return null;
    }

    const [match] = await tx
      .select({ score: matches.score, reason: matches.reason })
      .from(matches)
      .where(and(eq(matches.propertyId, r.propertyId), eq(matches.contactId, r.contactId)))
      .limit(1);
    const [profile] = await clientProfiles(tx, [r.contactId], { enquiries: 6, enquiryChars: 700 });
    const property = await propertyProfile(tx, r.propertyId);
    return { r, gate, person, match, profile, property };
  });
  if (!ctx || !ctx.property || !ctx.profile) return { skipped: true };
  const { r, gate, person, match, profile, property } = ctx;

  const request = [
    "THE CLIENT",
    `First name: ${person.firstName || "there"}`,
    profile.text,
    match ? `\nWhy they were picked (fit ${match.score.toFixed(2)}): ${match.reason}` : null,
    "",
    "THE PROPERTY",
    property.text,
  ]
    .filter((x) => x !== null)
    .join("\n");

  const prompt = loadPrompt("match-email.v2");
  try {
    const { data, generationId } = await runTask(draftSchema, {
      task: "match-email",
      model: "sonnet",
      output: "structured",
      system: [{ text: prompt.text, cache: true }],
      messages: [{ role: "user", content: request }],
      maxTokens: 1200,
      tenantId,
      entity: { type: "campaign_recipient", id: r.id },
      promptVersion: prompt.version,
    });

    await withTenant(tenantId, async (tx) => {
      // Re-check idempotency inside the write: two runs must not file two drafts.
      const [now] = await tx
        .select({ a: campaignRecipients.approvalItemId })
        .from(campaignRecipients)
        .where(eq(campaignRecipients.id, r.id))
        .for("update");
      if (now?.a) return;
      const [item] = await tx
        .insert(approvalItems)
        .values({
          tenantId,
          kind: "email",
          status: "pending",
          contactId: r.contactId,
          listingId: r.listingId,
          campaignId: r.campaignId,
          draftSubject: data.subject,
          draftBody: data.body,
          reviewNote: data.reviewNote,
          consentAtDraft: gate.consentStatus,
          consentCheckedAt: new Date(),
          aiGenerationId: generationId,
          model: "sonnet",
        })
        .returning({ id: approvalItems.id });
      await tx.update(campaignRecipients).set({ approvalItemId: item.id }).where(eq(campaignRecipients.id, r.id));
      await tx
        .update(campaigns)
        .set({ status: "in_approval" })
        .where(and(eq(campaigns.id, r.campaignId), inArray(campaigns.status, ["draft"])));
    });
    return { drafted: true };
  } catch (e) {
    if (e instanceof ClaudeError && e.retryable) throw e;
    const reason =
      e instanceof TaskOutputError ? "The AI's draft could not be read. Try drafting again." : `Drafting failed: ${(e instanceof Error ? e.message : String(e)).slice(0, 160)}`;
    await withTenant(tenantId, (tx) =>
      tx.update(campaignRecipients).set({ blockedReason: reason }).where(eq(campaignRecipients.id, r.id)),
    );
    return { failed: true };
  }
}

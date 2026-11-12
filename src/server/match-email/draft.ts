import { z } from "zod";
import { and, eq, inArray, sql } from "drizzle-orm";
import { withTenant } from "@/db";
import {
  approvalItems,
  campaignRecipients,
  campaigns,
  contactIntent,
  contactPreferenceSuburbs,
  contactPreferences,
  contacts,
  listings,
  matches,
  properties,
  suburbs,
} from "@/db/schema";
import { checkConsent } from "@/server/outbound/gate";
import { runTask, TaskOutputError } from "@/server/ai/run-task";
import { ClaudeError } from "@/server/ai/claude";
import { loadPrompt } from "@/server/ai/prompts";

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

const money = (n: number | null | undefined) =>
  n == null ? null : n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}m` : `$${Math.round(n / 1000)}k`;

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

    const [pref] = await tx.select().from(contactPreferences).where(eq(contactPreferences.contactId, r.contactId)).limit(1);
    const prefSuburbs = pref
      ? await tx
          .select({ name: suburbs.name })
          .from(contactPreferenceSuburbs)
          .innerJoin(suburbs, eq(suburbs.id, contactPreferenceSuburbs.suburbId))
          .where(eq(contactPreferenceSuburbs.preferenceId, pref.id))
      : [];
    const [intent] = await tx.select().from(contactIntent).where(eq(contactIntent.contactId, r.contactId)).limit(1);
    const [match] = await tx
      .select({ score: matches.score, reason: matches.reason })
      .from(matches)
      .where(and(eq(matches.propertyId, r.propertyId), eq(matches.contactId, r.contactId)))
      .limit(1);

    const [prop] = await tx
      .select({
        street: sql<string>`trim(coalesce(${properties.unit} || '/', '') || coalesce(${properties.streetNumber} || ' ', '') || coalesce(${properties.street}, ''))`,
        suburb: suburbs.name,
        type: properties.propertyType,
        beds: properties.beds,
        baths: properties.baths,
        parking: properties.parking,
        land: properties.landAreaSqm,
      })
      .from(properties)
      .leftJoin(suburbs, eq(suburbs.id, properties.suburbId))
      .where(eq(properties.id, r.propertyId))
      .limit(1);

    const [listing] = r.listingId
      ? await tx
          .select({
            type: listings.listingType,
            price: listings.priceDisplay,
            rentPw: listings.rentPw,
            headline: listings.publicHeadline,
            copy: listings.publicCopy,
            projectName: listings.projectName,
          })
          .from(listings)
          .where(eq(listings.id, r.listingId))
          .limit(1)
      : [];

    return { r, gate, person, pref, prefSuburbs, intent, match, prop, listing };
  });
  if (!ctx || !ctx.prop) return { skipped: true };
  const { r, gate, person, pref, prefSuburbs, intent, match, prop, listing } = ctx;

  const wants = [
    prefSuburbs.length ? `Suburbs: ${prefSuburbs.map((s) => s.name).join(", ")}` : null,
    pref?.postcodes?.length ? `Postcodes: ${pref.postcodes.join(", ")}` : null,
    pref?.priceMin || pref?.priceMax ? `Budget: ${money(pref?.priceMin) ?? "?"} to ${money(pref?.priceMax) ?? "?"}` : null,
    pref?.rentPwMin || pref?.rentPwMax ? `Rent: $${pref?.rentPwMin ?? "?"} to $${pref?.rentPwMax ?? "?"} per week` : null,
    pref?.bedsMin ? `At least ${pref.bedsMin} bedrooms` : null,
    pref?.bathsMin ? `At least ${pref.bathsMin} bathrooms` : null,
    pref?.parkingMin ? `At least ${pref.parkingMin} car spaces` : null,
    pref?.landSizeMin ? `Land at least ${pref.landSizeMin} m²` : null,
    pref?.propertyTypes?.length ? `Types: ${pref.propertyTypes.join(", ")}` : null,
    pref?.timeline ? `Timeline: ${pref.timeline}` : null,
    pref?.financeStatus ? `Finance: ${pref.financeStatus}` : null,
    pref?.softRequirements ? `In their words: ${pref.softRequirements}` : null,
  ].filter(Boolean);

  const request = [
    "THE PERSON",
    `First name: ${person.firstName || "there"}`,
    wants.length ? `What they want:\n- ${wants.join("\n- ")}` : "What they want: not recorded",
    intent?.rollingBrief ? `Brief: ${intent.rollingBrief}` : null,
    match ? `Why the engine matched them (score ${match.score.toFixed(2)}): ${match.reason}` : null,
    "",
    "THE PROPERTY",
    `Address: ${listing?.projectName ?? prop.street}, ${prop.suburb ?? ""}`,
    `Type: ${prop.type}`,
    [prop.beds != null && `${prop.beds} bed`, prop.baths != null && `${prop.baths} bath`, prop.parking != null && `${prop.parking} car`, prop.land && `${prop.land} m² land`]
      .filter(Boolean)
      .join(", "),
    listing ? `For ${listing.type === "rent" ? "lease" : "sale"}` : "Not advertised (an off-market opportunity)",
    listing?.price ? `Price wording (verbatim, the only price you may mention): ${listing.price}` : "Price wording: none",
    listing?.headline ? `Headline: ${listing.headline}` : null,
    listing?.copy ? `Description: ${listing.copy.slice(0, 1500)}` : null,
  ]
    .filter((x) => x !== null)
    .join("\n");

  const prompt = loadPrompt("match-email.v1");
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

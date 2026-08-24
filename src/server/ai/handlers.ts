import { z } from "zod";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { withTenant, type Tx } from "@/db";
import {
  contacts,
  contactRoles,
  contactIntent,
  contactPreferences,
  contactPreferenceSuburbs,
  interactions,
  confirmItems,
  suburbs,
} from "@/db/schema";
import { hasApiKey } from "./claude";
import { runTask } from "./run-task";
import { loadPrompt } from "./prompts";
import { taskProposal, preferenceChangeProposal } from "./proposals";
import { enqueue } from "@/server/jobs/queues";

/**
 * The two AI jobs (B4.4, §8): Haiku extracts, Sonnet writes the brief.
 *
 * Division of writes, per rule 5:
 *   - contact_intent is DERIVED — rebuilt from the log, wrong answers fixed by
 *     correcting the log — so the rebuild writes it directly.
 *   - anything touching PREFERENCES or TASKS is a proposal into confirm_items,
 *     and becomes real only when a human commits it.
 *
 * Both handlers are idempotent (BullMQ delivers at-least-once): the extraction
 * skips an interaction that already carries a summary, and proposal inserts are
 * keyed on (source interaction, kind, summary); the rebuild is an overwrite by
 * nature. Without an API key both succeed as explicit skips — honest, visible in
 * the job log, repaired later by `pnpm ai:backfill`.
 */

const INTENT_TYPES = ["buying", "selling", "renting", "investing", "browsing"] as const;
const SENTIMENTS = ["hot", "warm", "neutral", "cooling"] as const;

/* ------------------------------------------------------------- extraction */

export const extraction = z.object({
  summary: z.string().trim().min(1).max(600),
  intent: z.object({
    intentType: z.enum(INTENT_TYPES).nullable(),
    budgetBand: z.string().max(120).nullable(),
    timeline: z.string().max(120).nullable(),
    sentiment: z.enum(SENTIMENTS).nullable(),
    confidence: z.number().min(0).max(1),
  }),
  proposedTasks: z.array(taskProposal).max(5),
  proposedPreferenceChanges: z.array(preferenceChangeProposal).max(6),
  listingAddressMentions: z.array(z.string().max(120)).max(10),
});
export type Extraction = z.infer<typeof extraction>;

export async function summariseInteraction(tenantId: string, interactionId: string) {
  if (!hasApiKey()) return { skipped: "no-api-key" };

  const ctx = await withTenant(tenantId, async (tx) => {
    const [i] = await tx
      .select()
      .from(interactions)
      .where(eq(interactions.id, interactionId))
      .limit(1);
    if (!i || i.tombstonedAt) return null;
    // Already summarised: the job ran before (at-least-once delivery).
    if (i.aiSummary) return { done: true as const };

    const [c] = await tx
      .select({
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        tombstonedAt: contacts.tombstonedAt,
      })
      .from(contacts)
      .where(eq(contacts.id, i.contactId))
      .limit(1);
    if (!c || c.tombstonedAt) return null;

    const roles = await tx
      .select({ role: contactRoles.role })
      .from(contactRoles)
      .where(eq(contactRoles.contactId, c.id));
    const [intent] = await tx
      .select({ brief: contactIntent.rollingBrief })
      .from(contactIntent)
      .where(eq(contactIntent.contactId, c.id))
      .limit(1);

    return { i, c, roles: roles.map((r) => r.role), currentIntent: intent?.brief ?? null };
  });

  if (!ctx) return { skipped: "gone-or-tombstoned" };
  if ("done" in ctx) return { skipped: "already-summarised" };

  const prompt = loadPrompt("extract-interaction.v1");
  const { data } = await runTask(extraction, {
    task: "summarise-interaction",
    model: "haiku",
    tenantId,
    entity: { type: "interaction", id: interactionId },
    promptVersion: prompt.version,
    system: [{ text: prompt.text }],
    maxTokens: 1200,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          contact: {
            name: `${ctx.c.firstName} ${ctx.c.lastName}`,
            roles: ctx.roles,
            currentIntent: ctx.currentIntent,
          },
          interaction: {
            channel: ctx.i.channel,
            direction: ctx.i.direction,
            subject: ctx.i.subject,
            body: (ctx.i.body ?? "").slice(0, 8000),
          },
        }),
      },
    ],
  });

  await applyExtraction(tenantId, ctx.c.id, interactionId, data);

  /**
   * §8's chain, made real: the rebuild runs AFTER extraction so the brief reads
   * summaries instead of full bodies. Deduped by jobId, so a burst of enquiries
   * from one person collapses into one rebuild.
   */
  await enqueue("RebuildContactIntent", { tenantId, entityId: ctx.c.id });

  return {
    summarised: true,
    proposals: data.proposedTasks.length + data.proposedPreferenceChanges.length,
  };
}

/**
 * Write what an extraction found. Shared verbatim by the live handler and the
 * batch backfill (B4.6) — the discount must never buy different behaviour.
 */
export async function applyExtraction(
  tenantId: string,
  contactId: string,
  interactionId: string,
  data: Extraction,
) {
  await withTenant(tenantId, async (tx) => {
    await tx
      .update(interactions)
      .set({ aiSummary: data.summary })
      .where(eq(interactions.id, interactionId));

    for (const t of data.proposedTasks) {
      await insertProposal(tx, tenantId, contactId, interactionId, {
        kind: "task",
        summary: t.title,
        afterText: t.dueInDays !== null ? `${t.title} (due in ${t.dueInDays} days)` : t.title,
        proposed: t,
        confidence: data.intent.confidence,
        reason: t.reason,
      });
    }
    for (const p of data.proposedPreferenceChanges) {
      const current = await currentPreferenceText(tx, contactId, p.field);
      await insertProposal(tx, tenantId, contactId, interactionId, {
        kind: "preference_change",
        summary: `${labelFor(p.field)}: ${renderValue(p.value)}`,
        beforeText: current,
        afterText: renderValue(p.value),
        proposed: p,
        confidence: data.intent.confidence,
        reason: p.reason,
      });
    }
  });
}

/**
 * Insert-if-new: the dedupe key is (source interaction, kind, summary). A re-run
 * of the same job proposes the same things and must not double the queue.
 */
async function insertProposal(
  tx: Tx,
  tenantId: string,
  contactId: string,
  sourceInteractionId: string,
  p: {
    kind: "task" | "preference_change";
    summary: string;
    beforeText?: string | null;
    afterText: string;
    proposed: unknown;
    confidence: number;
    reason: string;
  },
) {
  const [existing] = await tx
    .select({ id: confirmItems.id })
    .from(confirmItems)
    .where(
      and(
        eq(confirmItems.sourceInteractionId, sourceInteractionId),
        eq(confirmItems.kind, p.kind),
        eq(confirmItems.summary, p.summary),
      ),
    )
    .limit(1);
  if (existing) return;

  await tx.insert(confirmItems).values({
    tenantId,
    contactId,
    sourceInteractionId,
    kind: p.kind,
    summary: p.summary,
    beforeText: p.beforeText ?? null,
    afterText: `${p.afterText} — ${p.reason}`,
    proposed: p.proposed,
    confidence: p.confidence,
  });
}

/* ---------------------------------------------------------------- rebuild */

const briefOutput = z.object({
  rollingBrief: z.string().trim().min(1).max(2000),
  intentType: z.enum(INTENT_TYPES).nullable(),
  budgetBand: z.string().max(120).nullable(),
  timeline: z.string().max(120).nullable(),
  blockers: z.array(z.string().max(200)).max(8),
  sentiment: z.enum(SENTIMENTS).nullable(),
  confidence: z.number().min(0).max(1),
});

export async function rebuildContactIntent(tenantId: string, contactId: string) {
  if (!hasApiKey()) return { skipped: "no-api-key" };

  const ctx = await withTenant(tenantId, async (tx) => {
    const [c] = await tx
      .select()
      .from(contacts)
      .where(eq(contacts.id, contactId))
      .limit(1);
    if (!c || c.tombstonedAt || c.mergedIntoId) return null;

    const roles = await tx
      .select({ role: contactRoles.role })
      .from(contactRoles)
      .where(eq(contactRoles.contactId, contactId));

    const [prefs] = await tx
      .select()
      .from(contactPreferences)
      .where(eq(contactPreferences.contactId, contactId))
      .limit(1);
    const prefSuburbs = prefs
      ? await tx
          .select({ name: suburbs.name })
          .from(contactPreferenceSuburbs)
          .innerJoin(suburbs, eq(suburbs.id, contactPreferenceSuburbs.suburbId))
          .where(eq(contactPreferenceSuburbs.preferenceId, prefs.id))
      : [];

    /**
     * Merged-in history matters here exactly as on the screen: the brief describes
     * a PERSON, and part of their story may sit on records merged into this one.
     */
    const mergedIn = await tx
      .select({ id: contacts.id })
      .from(contacts)
      .where(eq(contacts.mergedIntoId, contactId));
    const ids = [contactId, ...mergedIn.map((m) => m.id)];

    const log = await tx
      .select({
        occurredAt: interactions.occurredAt,
        channel: interactions.channel,
        direction: interactions.direction,
        subject: interactions.subject,
        body: interactions.body,
        aiSummary: interactions.aiSummary,
      })
      .from(interactions)
      .where(
        and(
          sql`${interactions.contactId} in ${ids}`,
          isNull(interactions.tombstonedAt),
        ),
      )
      .orderBy(desc(interactions.occurredAt))
      .limit(15);

    return { c, roles: roles.map((r) => r.role), prefs, prefSuburbs, log };
  });

  if (!ctx) return { skipped: "gone-tombstoned-or-merged" };
  // No interactions -> no brief. An empty state is honest; invented prose is not.
  if (ctx.log.length === 0) return { skipped: "no-interactions" };

  const prompt = loadPrompt("rolling-brief.v1");
  const { data } = await runTask(briefOutput, {
    task: "rebuild-contact-intent",
    model: "sonnet",
    tenantId,
    entity: { type: "contact", id: contactId },
    promptVersion: prompt.version,
    /**
     * The instruction file is the STABLE prefix, marked cacheable (B4.6). Sonnet's
     * minimum cacheable prefix is 1024 tokens; this prompt sits near it, so the
     * mark is cheap insurance — under the minimum it silently does not cache.
     */
    system: [{ text: prompt.text, cache: true }],
    maxTokens: 1000,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          today: new Date().toISOString().slice(0, 10),
          contact: {
            name: `${ctx.c.firstName} ${ctx.c.lastName}`,
            roles: ctx.roles,
            firstSeen: ctx.c.createdAt.toISOString().slice(0, 10),
          },
          preferences: ctx.prefs
            ? {
                priceMin: ctx.prefs.priceMin,
                priceMax: ctx.prefs.priceMax,
                bedsMin: ctx.prefs.bedsMin,
                bathsMin: ctx.prefs.bathsMin,
                parkingMin: ctx.prefs.parkingMin,
                suburbs: ctx.prefSuburbs.map((s) => s.name),
                propertyTypes: ctx.prefs.propertyTypes ?? [],
                timeline: ctx.prefs.timeline,
                financeStatus: ctx.prefs.financeStatus,
                softRequirements: ctx.prefs.softRequirements,
              }
            : null,
          interactions: ctx.log.map((i) => ({
            occurredAt: i.occurredAt.toISOString().slice(0, 10),
            channel: i.channel,
            direction: i.direction,
            subject: i.subject,
            // The summary where extraction has run; the body (bounded) where not.
            body: i.aiSummary ?? (i.body ?? "").slice(0, 1500),
          })),
        }),
      },
    ],
  });

  await withTenant(tenantId, (tx) =>
    tx
      .insert(contactIntent)
      .values({
        contactId,
        tenantId,
        intentType: data.intentType,
        budgetBand: data.budgetBand,
        timeline: data.timeline,
        blockers: data.blockers,
        sentiment: data.sentiment,
        confidence: data.confidence,
        rollingBrief: data.rollingBrief,
        rebuiltAt: new Date(),
      })
      .onConflictDoUpdate({
        target: contactIntent.contactId,
        set: {
          intentType: data.intentType,
          budgetBand: data.budgetBand,
          timeline: data.timeline,
          blockers: data.blockers,
          sentiment: data.sentiment,
          confidence: data.confidence,
          rollingBrief: data.rollingBrief,
          rebuiltAt: new Date(),
        },
      }),
  );

  return { rebuilt: true, sentiment: data.sentiment };
}

/* ---------------------------------------------------------------- helpers */

async function currentPreferenceText(tx: Tx, contactId: string, field: string) {
  const [prefs] = await tx
    .select()
    .from(contactPreferences)
    .where(eq(contactPreferences.contactId, contactId))
    .limit(1);
  if (!prefs) return null;
  if (field === "suburbs") {
    const rows = await tx
      .select({ name: suburbs.name })
      .from(contactPreferenceSuburbs)
      .innerJoin(suburbs, eq(suburbs.id, contactPreferenceSuburbs.suburbId))
      .where(eq(contactPreferenceSuburbs.preferenceId, prefs.id));
    return rows.length ? rows.map((r) => r.name).join(", ") : null;
  }
  const v = (prefs as Record<string, unknown>)[field];
  return v === null || v === undefined ? null : String(v);
}

const FIELD_LABELS: Record<string, string> = {
  priceMin: "Minimum price",
  priceMax: "Maximum price",
  bedsMin: "Minimum bedrooms",
  bathsMin: "Minimum bathrooms",
  parkingMin: "Minimum parking",
  timeline: "Timeline",
  financeStatus: "Finance",
  softRequirements: "Soft requirements",
  suburbs: "Suburbs",
};
function labelFor(field: string) {
  return FIELD_LABELS[field] ?? field;
}
function renderValue(v: unknown): string {
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "number") return v.toLocaleString("en-AU");
  return String(v);
}

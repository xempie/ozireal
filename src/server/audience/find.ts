import { z } from "zod";
import { and, eq, isNull, notExists, sql } from "drizzle-orm";
import { withTenant } from "@/db";
import { audienceRuns, contactRoles, contacts, matches } from "@/db/schema";
import { runTask, TaskOutputError } from "@/server/ai/run-task";
import { ClaudeError } from "@/server/ai/claude";
import { loadPrompt, fillPrompt } from "@/server/ai/prompts";
import { clientProfiles, propertyProfile } from "./profile";

/**
 * The AI audience finder (owner's request, 2026-11-13), the job FindAudience.
 *
 * For one property: every client the agency may email (email on file, latest email
 * consent granted, not do-not-contact, not an estate agent or developer) is described
 * from everything on record, and the model picks the ones the property genuinely suits,
 * with a specific reason. Picks are upserted into `matches`, so the Matching board shows
 * them with everything else. Nothing is sent: drafting and sending stay separate steps.
 */

export const MAX_PICKS = 30;

const out = z.object({
  picks: z
    .array(
      z.object({
        n: z.coerce.number().int().min(1),
        fit: z.coerce.number().min(0).max(1),
        reason: z.preprocess((v) => String(v ?? "").slice(0, 400), z.string().min(5)),
        hook: z.preprocess((v) => String(v ?? "").slice(0, 160), z.string()),
      }),
    )
    .transform((a) => a.slice(0, MAX_PICKS)),
});

export async function findAudience(tenantId: string, runId: string) {
  const prep = await withTenant(tenantId, async (tx) => {
    const [run] = await tx.select().from(audienceRuns).where(eq(audienceRuns.id, runId)).limit(1);
    if (!run || run.status === "done") return null;
    await tx.update(audienceRuns).set({ status: "running", error: null }).where(eq(audienceRuns.id, runId));

    const property = await propertyProfile(tx, run.propertyId);
    if (!property) return null;

    const eligible = await tx
      .select({ id: contacts.id })
      .from(contacts)
      .where(
        and(
          isNull(contacts.tombstonedAt),
          isNull(contacts.mergedIntoId),
          eq(contacts.doNotContact, false),
          sql`${contacts.emailRaw} is not null and ${contacts.emailRaw} <> ''`,
          sql`(select c.status from consents c where c.contact_id = ${contacts.id} and c.channel = 'email'
               order by c.occurred_at desc limit 1) = 'granted'`,
          notExists(
            tx
              .select({ x: sql`1` })
              .from(contactRoles)
              .where(and(eq(contactRoles.contactId, contacts.id), sql`${contactRoles.role} in ('agent','developer')`)),
          ),
        ),
      );
    const profiles = await clientProfiles(
      tx,
      eligible.map((e) => e.id),
    );
    return { run, property, profiles };
  });
  if (!prep) return { skipped: true };
  const { run, property, profiles } = prep;

  if (!profiles.length) {
    await withTenant(tenantId, (tx) =>
      tx
        .update(audienceRuns)
        .set({ status: "done", considered: 0, picked: 0, completedAt: new Date() })
        .where(eq(audienceRuns.id, runId)),
    );
    return { picked: 0 };
  }

  const list = profiles.map((p, i) => `#${i + 1}\n${p.text}`).join("\n\n");
  const prompt = loadPrompt("find-audience.v1");
  try {
    const { data, generationId } = await runTask(out, {
      task: "find-audience",
      model: "sonnet",
      output: "structured",
      system: [{ text: fillPrompt(prompt.text, { max: String(MAX_PICKS) }), cache: true }],
      messages: [
        {
          role: "user",
          content: `THE PROPERTY\n${property.text}\n\nTHE CLIENTS (${profiles.length})\n\n${list}\n\nReturn the JSON now.`,
        },
      ],
      maxTokens: 8000,
      tenantId,
      entity: { type: "property", id: run.propertyId },
      promptVersion: prompt.version,
    });

    const picks = data.picks
      .filter((p) => p.n >= 1 && p.n <= profiles.length)
      .map((p) => ({ ...p, contactId: profiles[p.n - 1].contactId }));
    const seen = new Set<string>();

    await withTenant(tenantId, async (tx) => {
      for (const p of picks) {
        if (seen.has(p.contactId)) continue;
        seen.add(p.contactId);
        const reason = p.hook ? `${p.reason} [Opening: ${p.hook}]` : p.reason;
        await tx
          .insert(matches)
          .values({
            tenantId,
            propertyId: run.propertyId,
            listingId: property.listingId,
            contactId: p.contactId,
            score: p.fit,
            reason,
            stage: "ranked",
            aiGenerationId: generationId,
          })
          .onConflictDoUpdate({
            target: [matches.propertyId, matches.contactId],
            set: { listingId: property.listingId, score: p.fit, reason, stage: "ranked", aiGenerationId: generationId, generatedAt: new Date() },
          });
      }
      await tx
        .update(audienceRuns)
        .set({ status: "done", considered: profiles.length, picked: seen.size, aiGenerationId: generationId, completedAt: new Date() })
        .where(eq(audienceRuns.id, runId));
    });
    return { picked: seen.size };
  } catch (e) {
    if (e instanceof ClaudeError && e.retryable) throw e;
    const msg =
      e instanceof TaskOutputError
        ? "The AI's answer could not be read. Try again."
        : (e instanceof Error ? e.message : String(e)).slice(0, 300);
    await withTenant(tenantId, (tx) =>
      tx.update(audienceRuns).set({ status: "failed", error: msg, considered: profiles.length }).where(eq(audienceRuns.id, runId)),
    );
    return { failed: true };
  }
}

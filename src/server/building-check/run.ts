import { z } from "zod";
import { eq } from "drizzle-orm";
import { withTenant } from "@/db";
import { buildingChecks, properties, suburbs } from "@/db/schema";
import { getMedia } from "@/server/media/s3";
import { runTask, TaskOutputError } from "@/server/ai/run-task";
import { ClaudeError } from "@/server/ai/claude";
import { loadPrompt } from "@/server/ai/prompts";
import type { ContentBlock } from "@/server/ai/claude";
export { AREAS, KEY_AREAS } from "@/lib/building-check";

/**
 * Runs a building check (2026-11-11): the owner's "building-check" skill as a job.
 *
 * Photos come from private storage, go to Claude as images with the versioned prompt
 * (prompts/building-check.v1.md, cached: it never varies), and the answer must pass
 * the Zod schema below before it is stored (runTask, §9). Nothing is written onto a
 * contact or a property; the check is its own record (rule 5).
 */

const money = z.preprocess((v) => { const n = Number(v); return v == null || v === "" || !Number.isFinite(n) || n < 0 ? null : Math.min(Math.round(n), 5_000_000); }, z.number().nullable());

/** Lenient parsing: a stray label or a long sentence must not throw away a whole check. */
const text = (max: number) => z.preprocess((v) => (v == null ? "" : String(v).slice(0, max)), z.string());
const textOrNull = (max: number) =>
  z.preprocess((v) => (v == null || v === "" ? null : String(v).slice(0, max)), z.string().nullable());
function pick<T extends string>(values: readonly [T, ...T[]], fallback: T, alias: Record<string, T> = {}) {
  return z.preprocess((v) => {
    const k = String(v ?? "").toLowerCase().trim().replace(/[\s/-]+/g, "_");
    return (values as readonly string[]).includes(k) ? k : (alias[k] ?? fallback);
  }, z.enum(values));
}
const STATUS = ["met", "not_met", "unverifiable", "not_applicable"] as const;
const STATUS_ALIAS: Record<string, (typeof STATUS)[number]> = {
  compliant: "met", pass: "met", yes: "met", ok: "met", present: "met",
  non_compliant: "not_met", fail: "not_met", no: "not_met", missing: "not_met", absent: "not_met",
  na: "not_applicable", n_a: "not_applicable", unknown: "unverifiable", unclear: "unverifiable",
  partial: "unverifiable", partially_met: "unverifiable", not_visible: "unverifiable",
};
const slice = (n: number) => <T>(a: T[]) => a.slice(0, n);

export const checkResult = z.object({
  headline: text(600),
  era: z.object({
    estimate: text(80),
    cues: text(400),
    implications: text(600),
  }),
  findings: z
    .array(
      z.object({
        severity: pick(["red", "amber", "green"] as const, "amber", { high: "red", critical: "red", medium: "amber", low: "green", cosmetic: "green" }),
        issue: text(160),
        location: text(120),
        reading: text(1200),
        confidence: pick(["confirmed", "likely", "needs_verification"] as const, "needs_verification", { high: "confirmed", medium: "likely", low: "needs_verification" }),
        verify: textOrNull(400),
        costLow: money,
        costHigh: money,
        costDriver: textOrNull(200),
        action: text(300),
        photos: z.preprocess((v) => (Array.isArray(v) ? v.map(Number).filter((n) => Number.isInteger(n) && n >= 1).slice(0, 40) : []), z.array(z.number())),
      }),
    )
    .transform(slice(60)),
  compliance: z
    .array(
      z.object({
        item: text(120),
        status: pick(STATUS, "unverifiable", STATUS_ALIAS),
        note: text(400),
      }),
    )
    .transform(slice(20)),
  missing: z.array(z.object({ area: text(120), why: text(300) })).transform(slice(20)),
  specialists: z.array(z.object({ trade: text(120), for: text(300) })).transform(slice(15)),
});
export type CheckResult = z.infer<typeof checkResult>;

const CONTEXT_LABEL = {
  buyer: "buyer (buyer advocacy)",
  pre_listing: "pre_listing (pre-listing / appraisal)",
  property_management: "property_management",
} as const;

async function streamToBytes(body: unknown): Promise<Uint8Array> {
  const b = body as { transformToByteArray?: () => Promise<Uint8Array> };
  if (typeof b?.transformToByteArray === "function") return b.transformToByteArray();
  throw new Error("Unreadable photo stream");
}

export async function runBuildingCheck(tenantId: string, checkId: string) {
  const check = await withTenant(tenantId, async (tx) => {
    const [c] = await tx.select().from(buildingChecks).where(eq(buildingChecks.id, checkId)).limit(1);
    if (!c) return null;
    let where: string | null = null;
    if (c.propertyId) {
      const [p] = await tx
        .select({ street: properties.street, number: properties.streetNumber, suburb: suburbs.name })
        .from(properties)
        .leftJoin(suburbs, eq(suburbs.id, properties.suburbId))
        .where(eq(properties.id, c.propertyId))
        .limit(1);
      if (p) where = [[p.number, p.street].filter(Boolean).join(" "), p.suburb].filter(Boolean).join(", ");
    }
    await tx.update(buildingChecks).set({ status: "running", error: null }).where(eq(buildingChecks.id, checkId));
    return { ...c, where };
  });
  if (!check) return { skipped: "gone" };

  try {
    const images: ContentBlock[] = [];
    const index: string[] = [];
    for (const [i, ph] of check.photos.entries()) {
      const m = await getMedia(ph.key);
      const bytes = await streamToBytes(m.body);
      const type = (m.contentType === "image/png" || m.contentType === "image/webp" ? m.contentType : "image/jpeg") as
        | "image/jpeg"
        | "image/png"
        | "image/webp";
      images.push({ type: "text", text: `Photo ${i + 1}${ph.area ? ` (area: ${ph.area})` : ""}` });
      images.push({ type: "image", source: { type: "base64", media_type: type, data: Buffer.from(bytes).toString("base64") } });
      index.push(`Photo ${i + 1}: ${ph.area ?? "untagged"}`);
    }

    const prompt = loadPrompt("building-check.v1");
    const request = [
      `Context: ${CONTEXT_LABEL[check.context]}`,
      `Property: ${check.where ?? check.label ?? "not stated"}`,
      check.notes ? `Agent's notes: ${check.notes}` : null,
      `${check.photos.length} photos follow, numbered in order.`,
      index.join("\n"),
    ]
      .filter(Boolean)
      .join("\n");

    const { data, generationId } = await runTask(checkResult, {
      task: "building-check",
      model: "sonnet",
      output: "structured",
      system: [{ text: prompt.text, cache: true }],
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: request },
            ...images,
            { type: "text", text: "Return the JSON object now." },
          ],
        },
      ],
      maxTokens: 12000,
      tenantId,
      entity: { type: "building_check", id: checkId },
      promptVersion: prompt.version,
    });

    // Most serious first, as the report reads.
    const order = { red: 0, amber: 1, green: 2 } as const;
    data.findings.sort((a, b) => order[a.severity] - order[b.severity]);

    await withTenant(tenantId, (tx) =>
      tx
        .update(buildingChecks)
        .set({ status: "done", result: data, aiGenerationId: generationId, completedAt: new Date(), error: null })
        .where(eq(buildingChecks.id, checkId)),
    );
    return { findings: data.findings.length };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await withTenant(tenantId, (tx) =>
      tx
        .update(buildingChecks)
        .set({ status: "failed", error: message.slice(0, 500) })
        .where(eq(buildingChecks.id, checkId)),
    );
    /**
     * Retry only what a retry can fix (a 429/5xx from the API, a network blip). An answer
     * that failed validation, or a config error, would just pay for the photos again;
     * it stays failed, with the raw output on the ledger row, and the agent can re-run.
     */
    const retryable = e instanceof ClaudeError ? e.retryable : !(e instanceof TaskOutputError);
    if (retryable) throw e;
    return { failed: message };
  }
}

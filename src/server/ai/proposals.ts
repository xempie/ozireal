import { z } from "zod";

/**
 * The shapes an AI proposal carries in confirm_items.proposed (B4.4/B4.5).
 *
 * Shared between the extraction handler that WRITES proposals and the commit
 * action that APPLIES them, so the two cannot drift apart. Committing applies
 * data; it never re-parses prose.
 */

export const taskProposal = z.object({
  title: z.string().trim().min(3).max(200),
  dueInDays: z.number().int().min(0).max(365).nullable().default(null),
  reason: z.string().trim().min(1).max(300),
});
export type TaskProposal = z.infer<typeof taskProposal>;

/** The columns a proposal may touch. A whitelist, not a free string — the model
 *  output cannot name a column the commit path never agreed to write. */
export const PREFERENCE_FIELDS = [
  "priceMin",
  "priceMax",
  "bedsMin",
  "bathsMin",
  "parkingMin",
  "timeline",
  "financeStatus",
  "softRequirements",
  "suburbs",
] as const;

export const preferenceChangeProposal = z.object({
  field: z.enum(PREFERENCE_FIELDS),
  /** Numbers for the numeric fields, a string for the text ones, names for suburbs.
   *  Validated against the specific field at commit time. */
  value: z.union([z.number(), z.string(), z.array(z.string())]),
  reason: z.string().trim().min(1).max(300),
});
export type PreferenceChangeProposal = z.infer<typeof preferenceChangeProposal>;

export const intentCorrectionProposal = z.object({
  field: z.enum(["intentType", "budgetBand", "timeline", "sentiment"]),
  value: z.string(),
  reason: z.string().trim().min(1).max(300),
});
export type IntentCorrectionProposal = z.infer<typeof intentCorrectionProposal>;

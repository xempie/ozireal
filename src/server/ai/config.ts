import { and, eq, gte, sql } from "drizzle-orm";
import { withTenant } from "@/db";
import { llmSettings, aiGenerations } from "@/db/schema";

/**
 * LLM configuration and the spend cap (migration 0011).
 *
 * Everything the agency can decide about how the AI behaves lives in one row per
 * tenant, read here and nowhere else. Before this, model ids sat in environment
 * variables, token ceilings were four literals at four call sites, and pricing
 * was a constant in a source file — none of them visible to the person paying
 * for it, and all of them needing a deploy to change.
 *
 * The budget check is ported from RoniDoc: meter every call and refuse BEFORE
 * doing the work, rather than discovering the month's spend at the end of it.
 */

export type LlmConfig = {
  fastModel: string;
  writingModel: string;
  structuredTemperature: number;
  proseTemperature: number;
  extractionMaxTokens: number;
  briefMaxTokens: number;
  rankingMaxTokens: number;
  monthlyBudgetAud: number | null;
  budgetAction: "block" | "warn";
  pricing: {
    fast: { input: number; output: number };
    writing: { input: number; output: number };
  };
  audPerUsd: number;
};

/**
 * Cached briefly. A settings change should take effect within a minute without
 * a restart, and without every AI call paying for a row read.
 */
const cache = new Map<string, { value: LlmConfig; at: number }>();
const TTL_MS = 30_000;

export function invalidateLlmConfig(tenantId: string) {
  cache.delete(tenantId);
}

export async function getLlmConfig(tenantId: string): Promise<LlmConfig> {
  const hit = cache.get(tenantId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const [row] = await withTenant(tenantId, (tx) =>
    tx.select().from(llmSettings).where(eq(llmSettings.tenantId, tenantId)).limit(1),
  );

  /**
   * A tenant created after 0011 ran has no row. Defaults here mirror the column
   * defaults exactly — the alternative is an AI layer that throws for a tenant
   * whose settings nobody has opened yet.
   */
  const value: LlmConfig = {
    fastModel: row?.fastModel ?? "claude-haiku-4-5",
    writingModel: row?.writingModel ?? "claude-sonnet-5",
    structuredTemperature: row?.structuredTemperature ?? 0,
    proseTemperature: row?.proseTemperature ?? 0.3,
    extractionMaxTokens: row?.extractionMaxTokens ?? 1200,
    briefMaxTokens: row?.briefMaxTokens ?? 1000,
    rankingMaxTokens: row?.rankingMaxTokens ?? 2000,
    monthlyBudgetAud: row?.monthlyBudgetAud ? Number(row.monthlyBudgetAud) : null,
    budgetAction: (row?.budgetAction as "block" | "warn") ?? "block",
    pricing: {
      fast: {
        input: Number(row?.fastInputUsdPerMtok ?? 1.0),
        output: Number(row?.fastOutputUsdPerMtok ?? 5.0),
      },
      writing: {
        input: Number(row?.writingInputUsdPerMtok ?? 2.0),
        output: Number(row?.writingOutputUsdPerMtok ?? 10.0),
      },
    },
    audPerUsd: Number(row?.audPerUsd ?? 1.55),
  };

  cache.set(tenantId, { value, at: Date.now() });
  return value;
}

/* ------------------------------------------------------------ spend cap */

export type BudgetState = {
  spentAud: number;
  budgetAud: number | null;
  /** 0..1+ — over 1 means the cap is exceeded. Null when no cap is set. */
  fraction: number | null;
  overBudget: boolean;
  action: "block" | "warn";
};

/**
 * Month-to-date spend against the cap, from the ledger B4 already writes.
 *
 * Calendar month in the tenant's own timezone would be more correct and needs
 * the tenant row; UTC month is used deliberately for now and stated here rather
 * than pretended otherwise — the difference is at most a few hours' spend at a
 * boundary, and the number is a budget guide, not an invoice.
 */
export async function getBudgetState(tenantId: string): Promise<BudgetState> {
  const config = await getLlmConfig(tenantId);
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [row] = await withTenant(tenantId, (tx) =>
    tx
      .select({ total: sql<string>`coalesce(sum(${aiGenerations.costAud}), 0)` })
      .from(aiGenerations)
      .where(
        and(eq(aiGenerations.tenantId, tenantId), gte(aiGenerations.createdAt, monthStart)),
      ),
  );

  const spentAud = Number(row?.total ?? 0);
  const budgetAud = config.monthlyBudgetAud;
  return {
    spentAud,
    budgetAud,
    fraction: budgetAud && budgetAud > 0 ? spentAud / budgetAud : null,
    overBudget: budgetAud !== null && spentAud >= budgetAud,
    action: config.budgetAction,
  };
}

export class BudgetExceededError extends Error {
  constructor(readonly state: BudgetState) {
    super(
      `The monthly AI budget of $${state.budgetAud?.toFixed(2)} AUD is spent ($${state.spentAud.toFixed(2)} used). New AI work is paused until the budget is raised in Settings or the month rolls over.`,
    );
  }
}

/**
 * Called before every paid call. Refusing here rather than after the fact is the
 * whole point: a cap discovered at the end of the month is not a cap.
 *
 * 'warn' deliberately does NOT throw — an agency may prefer to overspend rather
 * than lose a day of summaries, and that is their call to make, not ours.
 */
export async function assertWithinBudget(tenantId: string): Promise<void> {
  const state = await getBudgetState(tenantId);
  if (state.overBudget && state.action === "block") {
    throw new BudgetExceededError(state);
  }
}

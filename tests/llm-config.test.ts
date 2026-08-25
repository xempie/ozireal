import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import postgres from "postgres";
import { systemTenantId } from "@/db";

/**
 * LLM configuration and the spend cap (Settings → AI configuration).
 *
 * The claims worth testing: settings actually reach the API call, the database
 * refuses a temperature that would break structured output, and the budget stops
 * spending BEFORE the call rather than after the invoice.
 */

const h = vi.hoisted(() => ({
  session: {
    user: {
      id: "",
      name: "Sam Whitfield",
      email: "sam@ozirealty.com.au",
      tenantId: "",
      role: "principal",
    },
  } as { user: Record<string, string> } | null,
}));
vi.mock("@/auth", () => ({ auth: async () => h.session }));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

const { callClaude } = await import("@/server/ai/claude");
const { getLlmConfig, getBudgetState, invalidateLlmConfig, BudgetExceededError } =
  await import("@/server/ai/config");
const { saveLlmSettings } = await import("@/server/actions/llm");

let sql: postgres.Sql;
let tenantId: string;

beforeAll(async () => {
  sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  tenantId = await systemTenantId();
  const [u] = await sql<{ id: string }[]>`select id from users limit 1`;
  h.session!.user.tenantId = tenantId;
  h.session!.user.id = u.id;
});

afterAll(async () => {
  await sql?.end();
});

beforeEach(async () => {
  process.env.ANTHROPIC_API_KEY = "test-key-not-real";
  await sql`delete from tenant_secrets where name = 'ANTHROPIC_API_KEY'`;
  await sql`update llm_settings set monthly_budget_aud = null, budget_action = 'block',
            fast_model = 'claude-haiku-4-5', prose_temperature = 0.3,
            fast_input_usd_per_mtok = 1, fast_output_usd_per_mtok = 5, aud_per_usd = 1.55`;
  invalidateLlmConfig(tenantId);
});

function claudeOk(text = "ok") {
  return new Response(
    JSON.stringify({
      content: [{ type: "text", text }],
      usage: { input_tokens: 100, output_tokens: 20 },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

describe("the database protects structured output", () => {
  it("refuses any structured temperature other than 0", async () => {
    let message: string | null = null;
    try {
      await sql`update llm_settings set structured_temperature = 0.7`;
    } catch (e) {
      message = String((e as Error)?.message ?? e);
    }
    // There is no such thing as a creative JSON schema, so this is not a setting.
    expect(message).toMatch(/llm_structured_temperature_is_zero/);
  });

  it("refuses a prose temperature outside 0..1", async () => {
    let message: string | null = null;
    try {
      await sql`update llm_settings set prose_temperature = 2`;
    } catch (e) {
      message = String((e as Error)?.message ?? e);
    }
    expect(message).toMatch(/llm_prose_temperature_range/);
  });

  it("refuses a blank model id", async () => {
    let message: string | null = null;
    try {
      await sql`update llm_settings set writing_model = '   '`;
    } catch (e) {
      message = String((e as Error)?.message ?? e);
    }
    expect(message).toMatch(/llm_models_not_blank/);
  });
});

describe("settings reach the actual API call", () => {
  it("sends the configured model and temperature", async () => {
    await sql`update llm_settings set fast_model = 'claude-haiku-4-5-configured',
              prose_temperature = 0.55`;
    invalidateLlmConfig(tenantId);

    let sentBody = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u: unknown, init?: RequestInit) => {
        sentBody = String(init?.body ?? "");
        return claudeOk();
      }),
    );

    await callClaude({
      task: "config-check",
      model: "haiku",
      output: "prose",
      tenantId,
      messages: [{ role: "user", content: "hi" }],
    });

    const body = JSON.parse(sentBody);
    expect(body.model).toBe("claude-haiku-4-5-configured");
    expect(body.temperature).toBe(0.55);
  });

  it("pins structured calls to temperature 0 whatever prose is set to", async () => {
    await sql`update llm_settings set prose_temperature = 0.9`;
    invalidateLlmConfig(tenantId);

    let sentBody = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u: unknown, init?: RequestInit) => {
        sentBody = String(init?.body ?? "");
        return claudeOk();
      }),
    );

    await callClaude({
      task: "config-check",
      model: "haiku",
      output: "structured",
      tenantId,
      messages: [{ role: "user", content: "hi" }],
    });
    expect(JSON.parse(sentBody).temperature).toBe(0);
  });

  it("prices the call from the configured rates", async () => {
    await sql`update llm_settings set fast_input_usd_per_mtok = 2,
              fast_output_usd_per_mtok = 10, aud_per_usd = 2`;
    invalidateLlmConfig(tenantId);
    vi.stubGlobal("fetch", vi.fn(async () => claudeOk()));

    const r = await callClaude({
      task: "pricing-check",
      model: "haiku",
      output: "structured",
      tenantId,
      messages: [{ role: "user", content: "hi" }],
    });

    const [row] = await sql<{ cost_aud: string }[]>`
      select cost_aud from ai_generations where id = ${r.generationId}`;
    // 100 in at $2 + 20 out at $10 per MTok = $0.0004 USD, doubled by the rate.
    expect(Number(row.cost_aud)).toBeCloseTo(0.0004 * 2, 6);
  });
});

describe("the spend cap", () => {
  it("reports month-to-date spend against the cap", async () => {
    await sql`update llm_settings set monthly_budget_aud = 100`;
    invalidateLlmConfig(tenantId);
    const state = await getBudgetState(tenantId);
    expect(state.budgetAud).toBe(100);
    expect(state.spentAud).toBeGreaterThanOrEqual(0);
  });

  it("refuses a call BEFORE spending once the cap is passed", async () => {
    await sql`update llm_settings set monthly_budget_aud = 0, budget_action = 'block'`;
    invalidateLlmConfig(tenantId);

    const fetchSpy = vi.fn(async () => claudeOk());
    vi.stubGlobal("fetch", fetchSpy);

    await expect(
      callClaude({
        task: "over-budget",
        model: "haiku",
        output: "structured",
        tenantId,
        messages: [{ role: "user", content: "hi" }],
      }),
    ).rejects.toBeInstanceOf(BudgetExceededError);

    // The point of a cap: the money was never spent, not refunded afterwards.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("warn lets the call through, because overspending can be a deliberate choice", async () => {
    await sql`update llm_settings set monthly_budget_aud = 0, budget_action = 'warn'`;
    invalidateLlmConfig(tenantId);
    vi.stubGlobal("fetch", vi.fn(async () => claudeOk()));

    const r = await callClaude({
      task: "warn-only",
      model: "haiku",
      output: "structured",
      tenantId,
      messages: [{ role: "user", content: "hi" }],
    });
    expect(r.text).toBe("ok");
  });
});

describe("saving from the settings screen", () => {
  it("stores the values and they take effect immediately", async () => {
    const r = await saveLlmSettings({
      fastModel: "claude-haiku-4-5",
      writingModel: "claude-sonnet-5",
      proseTemperature: 0.4,
      extractionMaxTokens: 1500,
      briefMaxTokens: 1100,
      rankingMaxTokens: 2200,
      monthlyBudgetAud: 75,
      budgetAction: "warn",
      fastInputUsdPerMtok: 1,
      fastOutputUsdPerMtok: 5,
      writingInputUsdPerMtok: 2,
      writingOutputUsdPerMtok: 10,
      audPerUsd: 1.55,
    });
    expect(r.ok).toBe(true);

    const config = await getLlmConfig(tenantId);
    expect(config.proseTemperature).toBeCloseTo(0.4, 5);
    expect(config.monthlyBudgetAud).toBe(75);
    expect(config.budgetAction).toBe("warn");
    expect(config.rankingMaxTokens).toBe(2200);
  });

  it("refuses a model id that is obviously a paste accident", async () => {
    const r = await saveLlmSettings({
      fastModel: "Claude Sonnet (latest)",
      writingModel: "claude-sonnet-5",
      proseTemperature: 0.3,
      extractionMaxTokens: 1200,
      briefMaxTokens: 1000,
      rankingMaxTokens: 2000,
      monthlyBudgetAud: "",
      budgetAction: "block",
      fastInputUsdPerMtok: 1,
      fastOutputUsdPerMtok: 5,
      writingInputUsdPerMtok: 2,
      writingOutputUsdPerMtok: 10,
      audPerUsd: 1.55,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/does not look like a model id/i);
  });

  it("refuses a token ceiling below the schema floor", async () => {
    const r = await saveLlmSettings({
      fastModel: "claude-haiku-4-5",
      writingModel: "claude-sonnet-5",
      proseTemperature: 0.3,
      extractionMaxTokens: 10,
      briefMaxTokens: 1000,
      rankingMaxTokens: 2000,
      monthlyBudgetAud: "",
      budgetAction: "block",
      fastInputUsdPerMtok: 1,
      fastOutputUsdPerMtok: 5,
      writingInputUsdPerMtok: 2,
      writingOutputUsdPerMtok: 10,
      audPerUsd: 1.55,
    });
    expect(r.ok).toBe(false);
  });
});

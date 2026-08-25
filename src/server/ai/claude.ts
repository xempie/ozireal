import { createHash } from "node:crypto";
import { withTenant } from "@/db";
import { aiGenerations } from "@/db/schema";

/**
 * The one way this product talks to Claude (B4.1, §9).
 *
 * Direct fetch, no SDK — the surface is one endpoint and the abstraction would cost
 * more than it saves. What earns this wrapper its existence is the LEDGER: every
 * call, successful or not, writes an ai_generations row with model, tokens, cache
 * hits, cost in AUD, latency and the entity that caused the spend. §11's cost
 * discipline is only real if the spend is attributable per record, not per invoice.
 *
 * Failure philosophy comes from §8: this THROWS on anything unexpected, because
 * every caller is a BullMQ job whose retry/backoff/dead-letter machinery already
 * exists. Swallowing errors here would just hide them from it.
 */

/** Logical tiers, not model ids: call sites say what KIND of work it is (§9 — Haiku
 *  extracts and classifies, Sonnet writes) and the mapping lives in one place. */
export const MODELS = {
  haiku: process.env.AI_MODEL_HAIKU ?? "claude-haiku-4-5",
  sonnet: process.env.AI_MODEL_SONNET ?? "claude-sonnet-5",
} as const;
export type ModelTier = keyof typeof MODELS;

/**
 * USD per million tokens, checked against the published pricing page on 2026-08-24.
 *
 * Maintained by hand, which means it CAN drift — the mitigation is that the ledger
 * stores the cost computed at call time, so a later correction never rewrites
 * history, and a wrong constant shows up as costs that disagree with the invoice
 * rather than as silently wrong history. Re-check when a model tier changes.
 */
const PRICING_USD_PER_MTOK: Record<
  ModelTier,
  { input: number; output: number; cacheWrite: number; cacheRead: number }
> = {
  haiku: { input: 1.0, output: 5.0, cacheWrite: 1.25, cacheRead: 0.1 },
  sonnet: { input: 2.0, output: 10.0, cacheWrite: 2.5, cacheRead: 0.2 },
};

/** Cost lands in AUD because the invoice will. Overridable as the rate drifts. */
const AUD_PER_USD = Number(process.env.AUD_PER_USD ?? "1.55");

export type SystemBlock = {
  text: string;
  /** Mark the STABLE prefix (agency config, instructions) cacheable — B4.6. Order
   *  matters: cacheable blocks first, volatile content last. */
  cache?: boolean;
};

export type ClaudeCall = {
  /** Ledger label, e.g. 'summarise-interaction'. */
  task: string;
  model: ModelTier;
  system?: SystemBlock[];
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens?: number;
  tenantId: string;
  /** What caused the spend. */
  entity?: { type: string; id: string };
  /** Traceability of instructions without storing the prompt itself. */
  promptVersion?: string;
};

export type ClaudeResult = {
  text: string;
  generationId: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
  };
};

export class ClaudeError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    /** 429/5xx/529 are the transport having a moment — worth the job retrying.
     *  400/401 are OUR bug or config and retrying cannot help. */
    readonly retryable: boolean = true,
  ) {
    super(message);
  }
}

/**
 * The key comes from what the agency entered in Settings, falling back to the
 * environment for the worker, tests and CI. Tenant-scoped because the credential
 * is the agency's, not the server's — which is also what lets it be changed
 * without a deploy.
 */
export async function hasApiKey(tenantId: string): Promise<boolean> {
  const { getSecret } = await import("@/server/secrets");
  return !!(await getSecret(tenantId, "ANTHROPIC_API_KEY"));
}

export async function callClaude(call: ClaudeCall): Promise<ClaudeResult> {
  const { getSecret } = await import("@/server/secrets");
  const apiKey = await getSecret(call.tenantId, "ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new ClaudeError(
      "No Anthropic API key. Add one in Settings → Credentials.",
      undefined,
      false,
    );
  }

  const model = MODELS[call.model];
  const system = call.system?.map((b) =>
    b.cache
      ? { type: "text" as const, text: b.text, cache_control: { type: "ephemeral" as const } }
      : { type: "text" as const, text: b.text },
  );

  const body = {
    model,
    max_tokens: call.maxTokens ?? 1500,
    ...(system?.length ? { system } : {}),
    messages: call.messages,
  };

  const started = Date.now();
  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    // Network failure: no ledger row — nothing was spent, and the job will retry.
    throw new ClaudeError(
      `Network error calling Claude: ${e instanceof Error ? e.message : e}`,
    );
  }
  const latencyMs = Date.now() - started;

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const retryable = res.status === 429 || res.status >= 500;
    // A refused call still cost nothing worth ledgering (no tokens billed on 4xx/5xx).
    throw new ClaudeError(
      `Claude ${res.status}: ${detail.slice(0, 300)}`,
      res.status,
      retryable,
    );
  }

  const data = (await res.json()) as {
    content: { type: string; text?: string }[];
    stop_reason?: string;
    usage: {
      input_tokens: number;
      output_tokens: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  };

  const text = data.content
    .filter((c) => c.type === "text" && c.text)
    .map((c) => c.text)
    .join("");

  const usage = {
    inputTokens: data.usage.input_tokens ?? 0,
    outputTokens: data.usage.output_tokens ?? 0,
    cacheReadTokens: data.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: data.usage.cache_creation_input_tokens ?? 0,
  };

  /**
   * Truncation is deterministic, so it must not be retryable: the same oversized
   * input hits the same ceiling every attempt, and five paid calls later the job
   * dead-letters anyway. Ledger it (the tokens WERE billed), keep the partial text
   * for tuning, and fail in a way that names the actual fix. Found by the B4 review.
   */
  if (data.stop_reason === "max_tokens") {
    const generationId = await ledger(call, {
      model,
      usage,
      latencyMs,
      succeeded: false,
      rawResponse: text.slice(0, 20_000),
    });
    throw new ClaudeError(
      `${call.task}: response hit the ${call.maxTokens ?? 1500}-token ceiling and was truncated (generation ${generationId}). Raise maxTokens or shorten the input.`,
      undefined,
      false,
    );
  }

  const generationId = await ledger(call, {
    model,
    usage,
    latencyMs,
    succeeded: true,
  });

  return { text, generationId, usage };
}

/**
 * Mark a generation as failed AFTER the HTTP succeeded — schema validation caught
 * malformed output. The raw response is kept because prompt tuning needs it (§9).
 */
export async function markGenerationFailed(
  tenantId: string,
  generationId: string,
  rawResponse: string,
): Promise<void> {
  const { eq } = await import("drizzle-orm");
  await withTenant(tenantId, (tx) =>
    tx
      .update(aiGenerations)
      .set({ succeeded: false, rawResponse: rawResponse.slice(0, 20_000) })
      .where(eq(aiGenerations.id, generationId)),
  );
}

async function ledger(
  call: ClaudeCall,
  r: {
    model: string;
    usage: ClaudeResult["usage"];
    latencyMs: number;
    succeeded: boolean;
    rawResponse?: string;
  },
): Promise<string> {
  const p = PRICING_USD_PER_MTOK[call.model];
  const usd =
    (r.usage.inputTokens * p.input +
      r.usage.outputTokens * p.output +
      r.usage.cacheWriteTokens * p.cacheWrite +
      r.usage.cacheReadTokens * p.cacheRead) /
    1_000_000;

  const [row] = await withTenant(call.tenantId, (tx) =>
    tx
      .insert(aiGenerations)
      .values({
        tenantId: call.tenantId,
        task: call.task,
        model: r.model,
        promptHash: call.promptVersion
          ? createHash("sha256").update(call.promptVersion).digest("hex").slice(0, 16)
          : null,
        inputTokens: r.usage.inputTokens,
        outputTokens: r.usage.outputTokens,
        cachedInputTokens: r.usage.cacheReadTokens,
        costAud: (usd * AUD_PER_USD).toFixed(6),
        latencyMs: r.latencyMs,
        entityType: call.entity?.type,
        entityId: call.entity?.id,
        succeeded: r.succeeded,
        rawResponse: r.rawResponse ?? null,
      })
      .returning({ id: aiGenerations.id }),
  );
  return row.id;
}

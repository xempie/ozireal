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

/**
 * Logical tiers, not model ids: call sites say what KIND of work it is (§9 —
 * the fast model extracts and classifies, the writing model writes) and the
 * mapping now lives in Settings, per tenant, editable without a deploy.
 */
export type ModelTier = "haiku" | "sonnet";

/**
 * Cache multipliers are ratios of the input price, published as such, so they
 * are derived rather than being four more numbers for someone to keep in sync.
 */
/** Models that have refused `temperature` in this process. See `send` in callClaude. */
const NO_TEMPERATURE = new Set<string>();

const CACHE_WRITE_MULTIPLIER = 1.25;
const CACHE_READ_MULTIPLIER = 0.1;

export type SystemBlock = {
  text: string;
  /** Mark the STABLE prefix (agency config, instructions) cacheable — B4.6. Order
   *  matters: cacheable blocks first, volatile content last. */
  cache?: boolean;
};

/**
 * A message is plain text, or content blocks when a document rides along — a PDF is
 * sent as a base64 document block, which is how Claude reads one directly.
 */
export type ContentBlock =
  | { type: "text"; text: string }
  | {
      type: "document";
      source: { type: "base64"; media_type: "application/pdf"; data: string };
    }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

/** A tool the model may call (the assistant). `input_schema` is JSON Schema. */
export type ToolDefinition = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

export type ClaudeCall = {
  /** Ledger label, e.g. 'summarise-interaction'. */
  task: string;
  model: ModelTier;
  /**
   * Does a machine parse this output, or does a person read it?
   *
   * It selects the temperature, and the two are not interchangeable: structured
   * work is pinned at 0 (the database refuses anything else) because a creative
   * temperature on a JSON schema produces a failed job, not a better answer.
   */
  output: "structured" | "prose";
  system?: SystemBlock[];
  messages: { role: "user" | "assistant"; content: string | ContentBlock[] }[];
  tools?: ToolDefinition[];
  maxTokens?: number;
  tenantId: string;
  /** What caused the spend. */
  entity?: { type: string; id: string };
  /** Traceability of instructions without storing the prompt itself. */
  promptVersion?: string;
};

export type ClaudeResult = {
  text: string;
  /** Every block, including tool_use — the assistant loop needs more than the text. */
  content: ContentBlock[];
  stopReason: string | null;
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
  const { getLlmConfig, assertWithinBudget } = await import("./config");

  /**
   * The spend cap is checked BEFORE the call, not after — a budget discovered at
   * the end of the month is not a budget. Ported from RoniDoc, which refuses
   * with a 429 before doing any AI work.
   */
  await assertWithinBudget(call.tenantId);

  const apiKey = await getSecret(call.tenantId, "ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new ClaudeError(
      "No Anthropic API key. Add one in Settings → Credentials.",
      undefined,
      false,
    );
  }

  const config = await getLlmConfig(call.tenantId);
  const model = call.model === "haiku" ? config.fastModel : config.writingModel;
  const temperature =
    call.output === "structured" ? config.structuredTemperature : config.proseTemperature;
  const system = call.system?.map((b) =>
    b.cache
      ? { type: "text" as const, text: b.text, cache_control: { type: "ephemeral" as const } }
      : { type: "text" as const, text: b.text },
  );

  /**
   * Newer models refuse `temperature` outright ("`temperature` is deprecated for this
   * model"), claude-sonnet-5 among them. Rather than hardcode a list that goes stale
   * with every release, a model that refuses it once is remembered for the life of the
   * process and the call is retried without it. The refusal costs nothing: a 400 is
   * not billed.
   */
  const send = (withTemperature: boolean) =>
    fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: call.maxTokens ?? 1500,
        ...(withTemperature ? { temperature } : {}),
        ...(system?.length ? { system } : {}),
        ...(call.tools?.length ? { tools: call.tools } : {}),
        messages: call.messages,
      }),
    });

  const started = Date.now();
  let res: Response;
  let detail = "";
  try {
    res = await send(!NO_TEMPERATURE.has(model));
    if (res.status === 400 && !NO_TEMPERATURE.has(model)) {
      detail = await res.text().catch(() => "");
      if (/temperature/i.test(detail) && /deprecated|not supported|unsupported/i.test(detail)) {
        NO_TEMPERATURE.add(model);
        res = await send(false);
        detail = "";
      }
    }
  } catch (e) {
    // Network failure: no ledger row — nothing was spent, and the job will retry.
    throw new ClaudeError(
      `Network error calling Claude: ${e instanceof Error ? e.message : e}`,
    );
  }
  const latencyMs = Date.now() - started;

  if (!res.ok) {
    detail = detail || (await res.text().catch(() => ""));
    const retryable = res.status === 429 || res.status >= 500;
    // A refused call still cost nothing worth ledgering (no tokens billed on 4xx/5xx).
    throw new ClaudeError(
      `Claude ${res.status}: ${detail.slice(0, 300)}`,
      res.status,
      retryable,
    );
  }

  const data = (await res.json()) as {
    content: { type: string; text?: string; id?: string; name?: string; input?: unknown }[];
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

  const content: ContentBlock[] = data.content.flatMap((c): ContentBlock[] =>
    c.type === "text" && c.text
      ? [{ type: "text", text: c.text }]
      : c.type === "tool_use" && c.id && c.name
        ? [{ type: "tool_use", id: c.id, name: c.name, input: c.input ?? {} }]
        : [],
  );

  return { text, content, stopReason: data.stop_reason ?? null, generationId, usage };
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
  const { getLlmConfig } = await import("./config");
  const config = await getLlmConfig(call.tenantId);
  const p = call.model === "haiku" ? config.pricing.fast : config.pricing.writing;

  const usd =
    (r.usage.inputTokens * p.input +
      r.usage.outputTokens * p.output +
      r.usage.cacheWriteTokens * p.input * CACHE_WRITE_MULTIPLIER +
      r.usage.cacheReadTokens * p.input * CACHE_READ_MULTIPLIER) /
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
        costAud: (usd * config.audPerUsd).toFixed(6),
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

import { MODELS, type ModelTier, type SystemBlock } from "./claude";

/**
 * Message Batches (B4.6, §9): half price for anything that can wait an hour.
 * Nightly re-summarisation and bulk backfills go through here; nothing a person
 * is waiting on ever should.
 *
 * Same three headers as /v1/messages. Results are a .jsonl keyed by custom_id and
 * arrive in ANY order — the consumer must never zip by position.
 */

const BASE = "https://api.anthropic.com/v1/messages/batches";

function headers() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  return {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  };
}

export type BatchRequest = {
  /** ^[a-zA-Z0-9_-]{1,64}$ and unique within the batch. */
  customId: string;
  model: ModelTier;
  system?: SystemBlock[];
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens?: number;
};

export async function createBatch(requests: BatchRequest[]): Promise<{ id: string }> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      requests: requests.map((r) => ({
        custom_id: r.customId,
        params: {
          model: MODELS[r.model],
          max_tokens: r.maxTokens ?? 1200,
          ...(r.system?.length
            ? {
                system: r.system.map((b) =>
                  b.cache
                    ? { type: "text", text: b.text, cache_control: { type: "ephemeral" } }
                    : { type: "text", text: b.text },
                ),
              }
            : {}),
          messages: r.messages,
        },
      })),
    }),
  });
  if (!res.ok) {
    throw new Error(`Batch create failed ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = (await res.json()) as { id: string };
  return { id: data.id };
}

export type BatchStatus = {
  id: string;
  processingStatus: "in_progress" | "canceling" | "ended";
  counts: Record<string, number>;
  resultsUrl: string | null;
};

export async function getBatch(id: string): Promise<BatchStatus> {
  const res = await fetch(`${BASE}/${id}`, { headers: headers() });
  if (!res.ok) throw new Error(`Batch fetch failed ${res.status}`);
  const data = (await res.json()) as {
    id: string;
    processing_status: BatchStatus["processingStatus"];
    request_counts: Record<string, number>;
    results_url: string | null;
  };
  return {
    id: data.id,
    processingStatus: data.processing_status,
    counts: data.request_counts,
    resultsUrl: data.results_url,
  };
}

export type BatchResult = {
  customId: string;
  succeeded: boolean;
  text: string | null;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
  } | null;
  error: string | null;
};

export async function getBatchResults(resultsUrl: string): Promise<BatchResult[]> {
  const res = await fetch(resultsUrl, { headers: headers() });
  if (!res.ok) throw new Error(`Batch results fetch failed ${res.status}`);
  const lines = (await res.text()).trim().split("\n").filter(Boolean);

  return lines.map((line) => {
    const row = JSON.parse(line) as {
      custom_id: string;
      result: {
        type: "succeeded" | "errored" | "canceled" | "expired";
        message?: {
          content: { type: string; text?: string }[];
          usage: {
            input_tokens: number;
            output_tokens: number;
            cache_read_input_tokens?: number;
            cache_creation_input_tokens?: number;
          };
        };
        error?: { error?: { message?: string } };
      };
    };
    if (row.result.type === "succeeded" && row.result.message) {
      const m = row.result.message;
      return {
        customId: row.custom_id,
        succeeded: true,
        text: m.content
          .filter((c) => c.type === "text" && c.text)
          .map((c) => c.text)
          .join(""),
        usage: {
          inputTokens: m.usage.input_tokens ?? 0,
          outputTokens: m.usage.output_tokens ?? 0,
          cacheReadTokens: m.usage.cache_read_input_tokens ?? 0,
          cacheWriteTokens: m.usage.cache_creation_input_tokens ?? 0,
        },
        error: null,
      };
    }
    return {
      customId: row.custom_id,
      succeeded: false,
      text: null,
      usage: null,
      error: row.result.error?.error?.message ?? row.result.type,
    };
  });
}

import { withTenant } from "@/db";
import { aiGenerations } from "@/db/schema";
import { getSecret } from "@/server/secrets";

/**
 * Voyage embeddings (B5.2, §2 — Anthropic has no embeddings endpoint).
 *
 * The one detail that decides retrieval quality here is `input_type`. Voyage
 * prepends a different instruction to the text depending on whether it is being
 * stored or searched with, so a corpus embedded as "document" and queried as
 * "query" retrieves materially better than either used for both. Getting this
 * backwards is silent — the numbers still come back, they are just worse — so the
 * two call sites are separate functions rather than a boolean nobody reads.
 */

export const EMBED_MODEL = process.env.VOYAGE_MODEL ?? "voyage-4";
/** Pinned to match the vector(1024) column. A mismatch must fail on insert, not
 *  quietly fill an index with vectors of the wrong shape. */
export const EMBED_DIMENSION = 1024;

/** $0.06 per million tokens for voyage-4 (Aug 2026). Same ledger as Claude. */
const USD_PER_MTOK = Number(process.env.VOYAGE_USD_PER_MTOK ?? "0.06");
const AUD_PER_USD = Number(process.env.AUD_PER_USD ?? "1.55");

/** Max 1,000 inputs per request. Kept well under, so one failure costs less. */
const BATCH = 96;

export class VoyageError extends Error {
  constructor(
    message: string,
    readonly retryable = true,
  ) {
    super(message);
  }
}

export async function hasVoyageKey(tenantId: string): Promise<boolean> {
  return !!(await getSecret(tenantId, "VOYAGE_API_KEY"));
}

type EmbedResult = { vectors: number[][]; totalTokens: number };

async function embed(
  tenantId: string,
  texts: string[],
  inputType: "document" | "query",
  entity?: { type: string; id: string },
): Promise<EmbedResult> {
  const apiKey = await getSecret(tenantId, "VOYAGE_API_KEY");
  if (!apiKey) {
    throw new VoyageError("No Voyage API key. Add one in Settings → Credentials.", false);
  }

  const vectors: number[][] = [];
  let totalTokens = 0;
  const started = Date.now();

  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH);
    let res: Response;
    try {
      res = await fetch("https://api.voyageai.com/v1/embeddings", {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          input: slice,
          model: EMBED_MODEL,
          input_type: inputType,
          output_dimension: EMBED_DIMENSION,
          // Truncate rather than error: a 40-page property description is still
          // worth embedding, and losing the tail beats losing the listing.
          truncation: true,
        }),
      });
    } catch (e) {
      throw new VoyageError(`Network error: ${e instanceof Error ? e.message : e}`);
    }

    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      throw new VoyageError(
        `Voyage ${res.status}: ${detail}`,
        res.status === 429 || res.status >= 500,
      );
    }

    const data = (await res.json()) as {
      data: { embedding: number[]; index: number }[];
      usage?: { total_tokens?: number };
    };

    // Results carry their own index. Sort rather than trusting arrival order.
    const ordered = [...data.data].sort((a, b) => a.index - b.index);
    for (const d of ordered) {
      if (d.embedding.length !== EMBED_DIMENSION) {
        throw new VoyageError(
          `Voyage returned ${d.embedding.length} dimensions, expected ${EMBED_DIMENSION}. Check VOYAGE_MODEL.`,
          false,
        );
      }
      vectors.push(d.embedding);
    }
    totalTokens += data.usage?.total_tokens ?? 0;
  }

  // Embeddings are spend too, and they belong on the same ledger as Claude calls.
  await withTenant(tenantId, (tx) =>
    tx.insert(aiGenerations).values({
      tenantId,
      task: `embed:${inputType}`,
      model: EMBED_MODEL,
      inputTokens: totalTokens,
      outputTokens: 0,
      costAud: (((totalTokens * USD_PER_MTOK) / 1_000_000) * AUD_PER_USD).toFixed(6),
      latencyMs: Date.now() - started,
      entityType: entity?.type,
      entityId: entity?.id,
      succeeded: true,
    }),
  );

  return { vectors, totalTokens };
}

/** Embed text for STORAGE. */
export async function embedDocuments(
  tenantId: string,
  texts: string[],
  entity?: { type: string; id: string },
): Promise<number[][]> {
  if (texts.length === 0) return [];
  return (await embed(tenantId, texts, "document", entity)).vectors;
}

/** Embed text to SEARCH WITH. Never interchangeable with the above. */
export async function embedQuery(
  tenantId: string,
  text: string,
  entity?: { type: string; id: string },
): Promise<number[]> {
  const { vectors } = await embed(tenantId, [text], "query", entity);
  return vectors[0];
}

/** pgvector's literal form: '[0.1,0.2,...]'. */
export function toVectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}

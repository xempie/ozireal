import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { withTenant } from "@/db";
import { aiGenerations } from "@/db/schema";

/**
 * Embeddings via Amazon Bedrock — Titan Text Embeddings V2.
 *
 * Ported from RoniDoc (../aipa), which fixes the embedding model deliberately:
 * the chat provider is per-tenant and swappable, the EMBEDDING model is not,
 * because every vector in the index has to have been produced by the same model
 * to be comparable. A "better" embedding model is a full re-index, never a config
 * change — and RAIaitomation lists inconsistent dimensions as RoniDoc debt to fix
 * rather than inherit, so the dimension is pinned here and in the column.
 *
 * Two things this buys over a third-party embedding API:
 *   - no key. IAM role auth, so there is no credential to store, rotate or leak.
 *   - one bill. Embedding spend lands on the same AWS invoice as everything else.
 *
 * What it costs: Titan has no query/document distinction, so retrieval is
 * slightly worse than an asymmetric model. Stage 2 is a narrowing pass feeding a
 * Claude ranker, not the final answer, so that trade is acceptable here.
 */

export const EMBED_MODEL = process.env.EMBED_MODEL ?? "amazon.titan-embed-text-v2:0";
/** Pinned to match the vector(1024) column. A mismatch must fail loudly. */
export const EMBED_DIMENSION = 1024;

/** USD per million tokens for Titan Embeddings V2. */
const USD_PER_MTOK = Number(process.env.EMBED_USD_PER_MTOK ?? "0.02");
const AUD_PER_USD = Number(process.env.AUD_PER_USD ?? "1.55");

/** Titan truncates around 8k tokens; trimming here keeps the cost predictable. */
const MAX_CHARS = 8000;

export class EmbeddingError extends Error {
  constructor(
    message: string,
    readonly retryable = true,
  ) {
    super(message);
  }
}

let client: BedrockRuntimeClient | null = null;
function bedrock(): BedrockRuntimeClient {
  if (!client) {
    client = new BedrockRuntimeClient({
      region: process.env.AWS_REGION ?? "ap-southeast-2",
    });
  }
  return client;
}

/** Test seam — lets a suite inject a fake client without touching AWS. */
export function _setBedrockClient(c: BedrockRuntimeClient | null) {
  client = c;
}

/**
 * Bedrock is reachable when the process has AWS credentials — an instance role in
 * production, a profile or env vars locally. Unlike an API key there is nothing
 * to enter in Settings, so "configured" is a property of the environment.
 */
export function embeddingsAvailable(): boolean {
  return !!(
    /**
     * Explicit switch for an EC2 instance role. The role's credentials come from the
     * instance metadata service, which sets none of the variables below, so without
     * this every embedding in production was skipped as "no credentials" while the
     * job still reported done, and the similarity stage never ran. The SDK's default
     * credential chain finds the role on its own; this only says to try.
     */
    process.env.EMBEDDINGS === "bedrock" ||
    process.env.AWS_ACCESS_KEY_ID ||
    process.env.AWS_PROFILE ||
    process.env.AWS_ROLE_ARN ||
    // Set on EC2/ECS/Lambda by the runtime itself.
    process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI ||
    process.env.AWS_EXECUTION_ENV
  );
}

/**
 * Embed one text. Titan takes a single string per call — there is no batch
 * endpoint — so callers that need many should expect one request each.
 * Two retries on throttling and 5xx, matching RoniDoc.
 */
async function embedOne(text: string): Promise<{ vector: number[]; tokens: number }> {
  const body = JSON.stringify({
    inputText: text.slice(0, MAX_CHARS),
    dimensions: EMBED_DIMENSION,
    normalize: true,
  });

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await bedrock().send(
        new InvokeModelCommand({
          modelId: EMBED_MODEL,
          contentType: "application/json",
          accept: "application/json",
          body,
        }),
      );
      const parsed = JSON.parse(new TextDecoder().decode(res.body)) as {
        embedding: number[];
        inputTextTokenCount?: number;
      };

      if (!Array.isArray(parsed.embedding) || parsed.embedding.length !== EMBED_DIMENSION) {
        // Never store a vector of the wrong shape: it would poison the index and
        // every later cosine comparison against it.
        throw new EmbeddingError(
          `Bedrock returned ${parsed.embedding?.length ?? 0} dimensions, expected ${EMBED_DIMENSION}. Check EMBED_MODEL.`,
          false,
        );
      }
      return { vector: parsed.embedding, tokens: parsed.inputTextTokenCount ?? 0 };
    } catch (e) {
      if (e instanceof EmbeddingError && !e.retryable) throw e;
      lastError = e;
      const name = (e as { name?: string }).name ?? "";
      const retryable =
        /Throttling|TooManyRequests|ServiceUnavailable|InternalServer|Timeout/i.test(name);
      if (!retryable || attempt === 2) break;
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
    }
  }
  throw new EmbeddingError(
    `Bedrock embedding failed: ${lastError instanceof Error ? lastError.message : lastError}`,
  );
}

async function embedMany(
  tenantId: string,
  texts: string[],
  entity?: { type: string; id: string },
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const started = Date.now();
  const vectors: number[][] = [];
  let totalTokens = 0;

  for (const text of texts) {
    const { vector, tokens } = await embedOne(text);
    vectors.push(vector);
    totalTokens += tokens;
  }

  // Embeddings are spend, and belong on the same ledger as Claude calls.
  await withTenant(tenantId, (tx) =>
    tx.insert(aiGenerations).values({
      tenantId,
      task: "embed",
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

  return vectors;
}

/**
 * Titan is SYMMETRIC — the same model and no input_type — so storing and
 * searching use one function. The two names are kept because the call sites read
 * better for it, and because an asymmetric model later would need them separate.
 */
export async function embedDocuments(
  tenantId: string,
  texts: string[],
  entity?: { type: string; id: string },
): Promise<number[][]> {
  return embedMany(tenantId, texts, entity);
}

export async function embedQuery(
  tenantId: string,
  text: string,
  entity?: { type: string; id: string },
): Promise<number[]> {
  const [v] = await embedMany(tenantId, [text], entity);
  return v;
}

/** pgvector's literal form: '[0.1,0.2,...]'. */
export function toVectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}

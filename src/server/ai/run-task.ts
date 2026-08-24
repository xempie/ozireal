import { z } from "zod";
import {
  callClaude,
  markGenerationFailed,
  type ClaudeCall,
} from "./claude";

/**
 * runTask (B4.2, §9): prompt for JSON, parse, Zod-validate — the ONLY doorway
 * between a model's output and the database. On validation failure the job fails
 * and the raw response is kept on the ledger row; malformed output never reaches a
 * table. That rule is what lets "the AI proposed X" rows be trusted at all.
 */

export class TaskOutputError extends Error {
  constructor(
    message: string,
    readonly raw: string,
  ) {
    super(message);
  }
}

export async function runTask<S extends z.ZodTypeAny>(
  schema: S,
  call: ClaudeCall,
): Promise<{ data: z.infer<S>; generationId: string }> {
  const result = await callClaude(call);

  const json = extractJson(result.text);
  if (json === null) {
    await markGenerationFailed(call.tenantId, result.generationId, result.text);
    throw new TaskOutputError(
      `${call.task}: response contained no JSON object`,
      result.text,
    );
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    await markGenerationFailed(call.tenantId, result.generationId, result.text);
    const issues = parsed.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new TaskOutputError(`${call.task}: schema validation failed (${issues})`, result.text);
  }

  return { data: parsed.data, generationId: result.generationId };
}

/**
 * The first balanced JSON object in the text. Models are asked for JSON only, but a
 * stray preamble or a markdown fence must not fail a job that carried valid data.
 */
export function extractJson(text: string): unknown | null {
  const cleaned = text.replace(/```(?:json)?/g, "");
  const start = cleaned.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escaped) {
      escaped = false;
    } else if (ch === "\\" && inString) {
      escaped = true;
    } else if (ch === '"') {
      inString = !inString;
    } else if (!inString) {
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(cleaned.slice(start, i + 1));
          } catch {
            return null;
          }
        }
      }
    }
  }
  return null;
}

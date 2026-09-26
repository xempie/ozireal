"use server";

import { z } from "zod";
import { auth } from "@/auth";
import { callClaude, ClaudeError, type ContentBlock } from "@/server/ai/claude";
import { loadPrompt, fillPrompt } from "@/server/ai/prompts";
import { getAgency } from "@/server/queries";
import { TOOLS, TOOL_DEFINITIONS, isToolName, runReadTool } from "@/server/assistant/tools";
import { describeWrite, applyWrite, type WriteCard, type WriteOutcome } from "@/server/assistant/writes";
import type { ActionResult } from "./action";

/**
 * The assistant (chat widget), as two actions.
 *
 * assistantTurn — one exchange. Runs the model; read tools are answered on the spot and
 *   fed back, up to a few rounds. The moment the model proposes a CHANGE, the turn stops
 *   and returns it as a pending card. The model never executes a write (rules 1 and 5).
 *
 * assistantApply — runs one change the person confirmed, through that screen's own
 *   Server Action. The result goes back into the conversation on the next turn so the
 *   model can say what happened.
 *
 * Neither is defineAction: a turn can take several model round trips, and defineAction
 * would hold a database transaction open across all of them. Both still authenticate,
 * and both still Zod-validate their input (§13). Tenant scoping comes from the session
 * inside every query and action they call.
 *
 * The conversation lives in the browser and is sent back each turn. It holds nothing
 * the user could not already read on screen, and every change still passes through a
 * validated action, so a tampered history can at worst ask for something the user
 * could have done themselves.
 */

const PROMPT = "assistant.v3";
const MAX_ROUNDS = 6;

const block = z.union([
  z.object({ type: z.literal("text"), text: z.string().max(20_000) }),
  z.object({ type: z.literal("tool_use"), id: z.string().max(100), name: z.string().max(64), input: z.unknown() }),
  z.object({
    type: z.literal("tool_result"),
    tool_use_id: z.string().max(100),
    content: z.string().max(60_000),
    is_error: z.boolean().optional(),
  }),
]);
const message = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.union([z.string().min(1).max(8_000), z.array(block).min(1).max(40)]),
});
export type ChatMessage = z.infer<typeof message>;

export type PendingWrite = { id: string; name: string; input: unknown; card: WriteCard };

export type TurnResult = {
  messages: ChatMessage[];
  /** Changes awaiting Do it / Cancel. */
  pending: PendingWrite[];
  /** Read results from the same model message, sent back alongside the decisions. */
  pendingResults: ChatMessage["content"];
};

/**
 * Keep the history short enough to send each turn, cutting only at a plain user
 * message so a tool_use is never separated from its tool_result.
 */
function trim(messages: ChatMessage[], max = 40): ChatMessage[] {
  if (messages.length <= max) return messages;
  let start = messages.length - max;
  while (start < messages.length && !(messages[start].role === "user" && typeof messages[start].content === "string")) {
    start++;
  }
  return messages.slice(start);
}

async function session() {
  const s = await auth();
  return s?.user?.tenantId ? { tenantId: s.user.tenantId } : null;
}

export async function assistantTurn(raw: unknown): Promise<ActionResult<TurnResult>> {
  const s = await session();
  if (!s) return { ok: false, error: "You are signed out. Sign in and try again." };

  const parsed = z.object({ messages: z.array(message).min(1).max(120) }).safeParse(raw);
  if (!parsed.success) return { ok: false, error: "That conversation could not be read. Start a new chat." };

  const history: ChatMessage[] = trim(parsed.data.messages);
  const prompt = loadPrompt(PROMPT);
  const agency = await getAgency();
  const now = new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Australia/Adelaide",
  }).format(new Date());

  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const res = await callClaude({
        task: "assistant",
        model: "sonnet",
        output: "prose",
        system: [
          { text: fillPrompt(prompt.text, { agency: agency.name, user: agency.user.name }), cache: true },
          { text: `It is now ${now} in Adelaide.` },
        ],
        messages: history as { role: "user" | "assistant"; content: string | ContentBlock[] }[],
        tools: TOOL_DEFINITIONS,
        maxTokens: 2500,
        tenantId: s.tenantId,
        promptVersion: prompt.version,
      });

      const content = res.content.length ? res.content : [{ type: "text" as const, text: "…" }];
      history.push({ role: "assistant", content: content as ChatMessage["content"] });

      const uses = res.content.filter(
        (b): b is Extract<ContentBlock, { type: "tool_use" }> => b.type === "tool_use",
      );
      if (res.stopReason !== "tool_use" || uses.length === 0) {
        return { ok: true, data: { messages: history, pending: [], pendingResults: [] } };
      }

      const results: Extract<ContentBlock, { type: "tool_result" }>[] = [];
      const pending: PendingWrite[] = [];

      for (const u of uses) {
        if (!isToolName(u.name)) {
          results.push({ type: "tool_result", tool_use_id: u.id, content: `Unknown tool ${u.name}.`, is_error: true });
          continue;
        }
        const spec = TOOLS[u.name];
        const valid = (spec.schema as z.ZodTypeAny).safeParse(u.input ?? {});
        if (!valid.success) {
          const issues = valid.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
          results.push({ type: "tool_result", tool_use_id: u.id, content: `Invalid input (${issues}).`, is_error: true });
          continue;
        }
        if (spec.kind === "read") {
          try {
            const out = await runReadTool(u.name, valid.data);
            results.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(out).slice(0, 30_000) });
          } catch (e) {
            results.push({
              type: "tool_result",
              tool_use_id: u.id,
              content: `Lookup failed: ${e instanceof Error ? e.message.slice(0, 200) : "unknown error"}`,
              is_error: true,
            });
          }
        } else {
          const input = valid.data as Record<string, unknown>;
          pending.push({ id: u.id, name: u.name, input, card: await describeWrite(u.name, input) });
        }
      }

      if (pending.length > 0) {
        return { ok: true, data: { messages: history, pending, pendingResults: results } };
      }
      history.push({ role: "user", content: results });
    }

    history.push({
      role: "assistant",
      content: "That took more steps than I allow in one go. Ask again with a narrower question.",
    });
    return { ok: true, data: { messages: history, pending: [], pendingResults: [] } };
  } catch (e) {
    if (e instanceof ClaudeError) {
      return {
        ok: false,
        error: /API key/i.test(e.message)
          ? "The assistant needs an Anthropic API key. Add one in Advanced → Settings → Credentials."
          : /budget|spend/i.test(e.message)
            ? e.message
            : "The assistant could not answer just now. Try again in a moment.",
      };
    }
    console.error("[assistant] turn failed:", e instanceof Error ? e.message : e);
    return { ok: false, error: "The assistant could not answer just now. Try again in a moment." };
  }
}

export async function assistantApply(raw: unknown): Promise<ActionResult<WriteOutcome>> {
  const s = await session();
  if (!s) return { ok: false, error: "You are signed out. Sign in and try again." };

  const parsed = z.object({ name: z.string().max(64), input: z.unknown() }).safeParse(raw);
  if (!parsed.success || !isToolName(parsed.data.name) || TOOLS[parsed.data.name].kind !== "write") {
    return { ok: false, error: "That is not a change the assistant can make." };
  }
  return { ok: true, data: await applyWrite(parsed.data.name, parsed.data.input) };
}

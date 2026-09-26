"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, X, Send, RotateCcw, Check, Ban, Loader2, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  assistantTurn,
  assistantApply,
  type ChatMessage,
  type PendingWrite,
} from "@/server/actions/assistant";

/**
 * The assistant, bottom right on every console page.
 *
 * It answers from the CRM's own data, and it can make changes — but a change never
 * happens from the model alone. Each one arrives as a card with Do it / Cancel; only
 * the person's press runs it (rules 1 and 5), through the same action the screen's own
 * button uses. Messages it drafts go to Approvals and are sent from there.
 *
 * The conversation is kept in sessionStorage so it survives moving between pages and a
 * reload, and ends with the tab.
 */

type CardState = {
  name: string;
  input: unknown;
  card: PendingWrite["card"];
  status: "waiting" | "applying" | "done" | "failed" | "declined";
  message?: string;
  href?: string;
};

type Stored = { messages: ChatMessage[]; cards: Record<string, CardState> };

const STORE_KEY = "ozi-assistant";

const SUGGESTIONS = [
  "What needs my attention today?",
  "Which properties are off market?",
  "Who has a follow-up due?",
  "Add a task to call my newest contact tomorrow",
];

function load(): Stored {
  try {
    const raw = window.sessionStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as Stored;
  } catch {
    /* private mode or cleared storage: start empty */
  }
  return { messages: [], cards: {} };
}

function save(s: Stored) {
  try {
    window.sessionStorage.setItem(STORE_KEY, JSON.stringify(s));
  } catch {
    /* storage full or blocked: the chat still works for this page */
  }
}

/** Just enough formatting for the model's replies: paragraphs, bullet lists, **bold**. */
function Formatted({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
    );
  return (
    <>
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*([-*•]|\d+\.)\s+/.test(l))) {
          return (
            <ul key={i} className="list-disc pl-5 space-y-0.5 my-1.5">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*([-*•]|\d+\.)\s+/, ""))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="my-1.5 first:mt-0 last:mb-0 whitespace-pre-wrap">
            {inline(b)}
          </p>
        );
      })}
    </>
  );
}

function ActionCard({
  state,
  onDecide,
}: {
  state: CardState;
  onDecide?: (doIt: boolean) => void;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3 my-2 text-[13px]",
        state.status === "waiting" || state.status === "applying"
          ? "border-[var(--accent)]/50 accent-soft"
          : "surface-3",
      )}
    >
      <div className="font-medium">{state.card.title}</div>
      {state.card.lines.length > 0 && (
        <ul className="text-2 text-[12.5px] mt-1 space-y-0.5">
          {state.card.lines.map((l, i) => (
            <li key={i} className="whitespace-pre-wrap break-words">
              {l}
            </li>
          ))}
        </ul>
      )}

      {state.status === "waiting" && onDecide && (
        <div className="flex gap-2 mt-2.5">
          <button
            type="button"
            onClick={() => onDecide(true)}
            className="inline-flex items-center gap-1 rounded-md bg-[var(--accent)] text-white text-[12.5px] font-medium px-3 min-h-8 hover:opacity-90"
          >
            <Check size={13} /> Do it
          </button>
          <button
            type="button"
            onClick={() => onDecide(false)}
            className="inline-flex items-center gap-1 rounded-md surface-2 border text-[12.5px] px-3 min-h-8 hover:surface-3"
          >
            Cancel
          </button>
        </div>
      )}
      {state.status === "applying" && (
        <div className="flex items-center gap-1.5 mt-2 text-2 text-[12.5px]">
          <Loader2 size={13} className="animate-spin" /> Working…
        </div>
      )}
      {state.status === "done" && (
        <div className="flex items-center gap-1.5 mt-2 text-[12.5px] text-[#006300] dark:text-[#5fc45f]">
          <Check size={13} /> {state.message}
          {state.href && (
            <Link href={state.href} className="ml-auto inline-flex items-center gap-0.5 underline underline-offset-2">
              Open <ArrowUpRight size={12} />
            </Link>
          )}
        </div>
      )}
      {state.status === "failed" && (
        <div className="mt-2 text-[12.5px] text-[#b02f2f] dark:text-[#f08a8a]">{state.message}</div>
      )}
      {state.status === "declined" && (
        <div className="flex items-center gap-1.5 mt-2 text-3 text-[12.5px]">
          <Ban size={12} /> Cancelled
        </div>
      )}
    </div>
  );
}

export function AssistantWidget() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [cards, setCards] = React.useState<Record<string, CardState>>({});
  const [pending, setPending] = React.useState<PendingWrite[]>([]);
  const [pendingResults, setPendingResults] = React.useState<ChatMessage["content"]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState("");
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  /** Outcomes of the current batch of cards, collected until every one is decided. */
  const decisions = React.useRef<Record<string, { ok: boolean; message: string; declined: boolean }>>({});

  React.useEffect(() => {
    const s = load();
    /**
     * A reload while cards were waiting leaves a proposed change with no answer, and the
     * API refuses a conversation like that. Close them out honestly as not done.
     */
    const last = s.messages[s.messages.length - 1];
    const open =
      last?.role === "assistant" && Array.isArray(last.content)
        ? last.content.filter((b) => b.type === "tool_use")
        : [];
    if (open.length) {
      s.messages.push({
        role: "user",
        content: open.map((b) => ({
          type: "tool_result" as const,
          tool_use_id: b.type === "tool_use" ? b.id : "",
          content: "The page was reloaded before the user decided. Nothing was done.",
        })),
      });
      for (const b of open) {
        if (b.type === "tool_use" && s.cards[b.id]) s.cards[b.id] = { ...s.cards[b.id], status: "declined" };
      }
    }
    setMessages(s.messages);
    setCards(s.cards);
  }, []);

  React.useEffect(() => {
    save({ messages, cards });
  }, [messages, cards]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, cards, busy, open]);

  React.useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  async function runTurn(next: ChatMessage[]) {
    setBusy(true);
    setError(null);
    setMessages(next);
    try {
      const r = await assistantTurn({ messages: next });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setMessages(r.data.messages);
      setPending(r.data.pending);
      setPendingResults(r.data.pendingResults);
      if (r.data.pending.length) {
        setCards((prev) => {
          const copy = { ...prev };
          for (const p of r.data.pending) {
            copy[p.id] = { name: p.name, input: p.input, card: p.card, status: "waiting" };
          }
          return copy;
        });
      }
    } catch {
      setError("The assistant could not be reached. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function send(text: string) {
    const t = text.trim();
    if (!t || busy || pending.length) return;
    setDraft("");
    void runTurn([...messages, { role: "user", content: t }]);
  }

  /** Once every card in the batch is decided, the outcomes go back to the model. */
  async function decide(id: string, doIt: boolean) {
    const p = pending.find((x) => x.id === id);
    if (!p) return;

    let result: { ok: boolean; message: string; href?: string };
    if (doIt) {
      setCards((prev) => ({ ...prev, [id]: { ...prev[id], status: "applying" } }));
      try {
        const r = await assistantApply({ name: p.name, input: p.input });
        result = r.ok ? r.data : { ok: false, message: r.error };
      } catch {
        result = { ok: false, message: "Could not reach the server. Nothing was changed." };
      }
      setCards((prev) => ({
        ...prev,
        [id]: { ...prev[id], status: result.ok ? "done" : "failed", message: result.message, href: result.href },
      }));
      if (result.ok) router.refresh();
    } else {
      result = { ok: false, message: "The user cancelled this change." };
      setCards((prev) => ({ ...prev, [id]: { ...prev[id], status: "declined" } }));
    }

    const decided = { ...decisions.current, [id]: { ...result, declined: !doIt } };
    decisions.current = decided;
    if (pending.every((x) => decided[x.id])) {
      const toolResults = pending.map((x) => ({
        type: "tool_result" as const,
        tool_use_id: x.id,
        content: decided[x.id].declined
          ? "The user cancelled this change. Nothing was done."
          : decided[x.id].ok
            ? `Done: ${decided[x.id].message}`
            : `Failed: ${decided[x.id].message}`,
        is_error: !decided[x.id].ok && !decided[x.id].declined,
      }));
      decisions.current = {};
      const prior = Array.isArray(pendingResults) ? pendingResults : [];
      setPending([]);
      setPendingResults([]);
      await runTurn([...messages, { role: "user", content: [...prior, ...toolResults] }]);
    }
  }

  function reset() {
    setMessages([]);
    setCards({});
    setPending([]);
    setPendingResults([]);
    setError(null);
    decisions.current = {};
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[55] h-14 w-14 rounded-full bg-[var(--accent)] text-white shadow-lg grid place-items-center hover:opacity-90 transition-opacity"
          aria-label="Open the assistant"
          title="Ask the assistant"
        >
          <Sparkles size={24} />
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="Assistant"
          className="fixed z-[55] inset-0 sm:inset-auto sm:bottom-6 sm:right-6 sm:w-[410px] sm:h-[min(660px,calc(100vh-48px))] surface-2 sm:border sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        >
          <div className="flex items-center gap-2 px-4 h-14 border-b shrink-0">
            <span className="h-8 w-8 rounded-full bg-[var(--accent)] text-white grid place-items-center">
              <Sparkles size={16} />
            </span>
            <div className="min-w-0">
              <div className="text-[14px] font-semibold leading-tight">Assistant</div>
              <div className="text-3 text-[11px] leading-tight">Asks before it changes anything</div>
            </div>
            <button
              type="button"
              onClick={reset}
              disabled={busy}
              className="ml-auto text-3 hover:text-[var(--text)] p-2 rounded-md hover:surface-3 disabled:opacity-40"
              title="New chat"
              aria-label="New chat"
            >
              <RotateCcw size={16} />
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-3 hover:text-[var(--text)] p-2 rounded-md hover:surface-3"
              aria-label="Close the assistant"
            >
              <X size={18} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && !busy && (
              <div className="pt-6">
                <p className="text-[14px] font-medium">What can I do for you?</p>
                <p className="text-2 text-[13px] mt-1">
                  Ask about your contacts, properties, listings and tasks, or ask me to
                  add, update or draft something. I will show you each change before it
                  happens.
                </p>
                <div className="flex flex-col gap-2 mt-4">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="text-left text-[13px] rounded-lg border px-3 py-2 hover:surface-3"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => {
              if (m.role === "user") {
                if (typeof m.content !== "string") return null; // tool results: not for display
                return (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-[var(--accent)] text-white px-3.5 py-2 text-[13.5px] whitespace-pre-wrap">
                      {m.content}
                    </div>
                  </div>
                );
              }
              const blocks = typeof m.content === "string" ? [{ type: "text" as const, text: m.content }] : m.content;
              return (
                <div key={i} className="text-[13.5px] leading-relaxed">
                  {blocks.map((b, j) =>
                    b.type === "text" ? (
                      <Formatted key={j} text={b.text} />
                    ) : b.type === "tool_use" && cards[b.id] ? (
                      <ActionCard
                        key={j}
                        state={cards[b.id]}
                        onDecide={
                          pending.some((p) => p.id === b.id) && !busy
                            ? (doIt) => void decide(b.id, doIt)
                            : undefined
                        }
                      />
                    ) : null,
                  )}
                </div>
              );
            })}

            {busy && (
              <div className="flex items-center gap-2 text-2 text-[13px]">
                <Loader2 size={14} className="animate-spin" /> Thinking…
              </div>
            )}
            {error && (
              <div className="rounded-lg border border-[#d03b3b]/45 bg-[#d03b3b]/8 p-2.5 text-[12.5px]">
                {error}
              </div>
            )}
          </div>

          <form
            className="border-t p-3 flex items-end gap-2 shrink-0"
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
          >
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(draft);
                }
              }}
              rows={1}
              maxLength={4000}
              placeholder={pending.length ? "Choose Do it or Cancel above first" : "Ask or tell me what to do…"}
              disabled={busy || pending.length > 0}
              className="flex-1 resize-none max-h-32 rounded-lg border surface-3 px-3 py-2 text-[16px] sm:text-[13.5px] outline-none focus:border-[var(--accent)] disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={busy || !draft.trim() || pending.length > 0}
              className="h-10 w-10 rounded-lg bg-[var(--accent)] text-white grid place-items-center hover:opacity-90 disabled:opacity-40 shrink-0"
              aria-label="Send"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}

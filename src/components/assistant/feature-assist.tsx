"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Sparkles, ImagePlus, ArrowUp } from "lucide-react";
import { suggestionsFor } from "./page-suggestions";
import { openAssistant } from "./ask-button";
import { attachmentsFrom } from "./attachments";

/**
 * The assistant, visible on each feature (2026-11-12): a slim bar at the top of the page
 * that knows which feature it is on. Type, paste a message, or paste/drop a screenshot,
 * and it goes straight to the assistant, which acts on it in one go (prompt v6).
 * The chips are this feature's most useful asks. The chat itself is the existing panel.
 */
export function FeatureAssist() {
  const pathname = usePathname();
  const { area, items } = suggestionsFor(pathname);
  const [text, setText] = React.useState("");
  const [dragging, setDragging] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const label = area === "everything" ? "anything" : area;

  async function sendImages(list: DataTransferItemList | FileList | null) {
    const images = await attachmentsFrom(list);
    if (!images.length) return;
    openAssistant({ send: text.trim() || undefined, images });
    setText("");
  }

  function submit() {
    const t = text.trim();
    if (!t) return openAssistant({});
    openAssistant({ send: t });
    setText("");
  }

  return (
    <div className="mb-5 print:hidden">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void sendImages(e.dataTransfer.files);
        }}
        className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 transition-colors ${
          dragging
            ? "border-[var(--accent)] bg-[var(--accent)]/[0.08]"
            : "border-[var(--accent)]/30 bg-[var(--accent)]/[0.035] focus-within:border-[var(--accent)]"
        }`}
      >
        <span className="h-7 w-7 rounded-full bg-[var(--accent)] text-white grid place-items-center shrink-0">
          <Sparkles size={14} />
        </span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={(e) => {
            if (Array.from(e.clipboardData.items).some((it) => it.type.startsWith("image/"))) {
              e.preventDefault();
              void sendImages(e.clipboardData.items);
            }
          }}
          aria-label={`Ask AI about ${label}`}
          placeholder={`Ask AI about ${label}, or paste a screenshot or message…`}
          className="flex-1 min-w-0 bg-transparent outline-none text-[16px] sm:text-[13.5px] py-1.5"
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            void sendImages(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="h-8 w-8 rounded-lg grid place-items-center text-2 hover:text-[var(--accent)] hover:bg-[var(--accent)]/[0.08] shrink-0"
          aria-label="Add a screenshot or photo"
          title="Screenshot or photo"
        >
          <ImagePlus size={17} />
        </button>
        <button
          type="submit"
          className="h-8 w-8 rounded-lg bg-[var(--accent)] text-white grid place-items-center hover:opacity-90 shrink-0"
          aria-label="Ask"
        >
          <ArrowUp size={16} />
        </button>
      </form>
      <div className="flex gap-1.5 mt-2 overflow-x-auto pb-0.5">
        {items.slice(0, 4).map((sug) => (
          <button
            key={sug.label}
            type="button"
            onClick={() => openAssistant(sug.send ? { send: sug.send } : { prefill: sug.prefill ?? sug.label })}
            className="shrink-0 whitespace-nowrap text-[12px] rounded-full border px-2.5 py-1 text-2 hover:text-[var(--accent)] hover:border-[var(--accent)]/40"
          >
            {sug.label}
          </button>
        ))}
      </div>
    </div>
  );
}

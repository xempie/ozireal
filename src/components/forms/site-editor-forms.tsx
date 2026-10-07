"use client";

import * as React from "react";
import { Eye, Upload, Undo2, History, RotateCcw } from "lucide-react";
import { useAction, FormError } from "./action-form";
import {
  publishSitePath,
  discardSiteDraft,
  restoreSiteVersion,
} from "@/server/actions/site-content";

/**
 * The website editor's buttons. Edits themselves come from the assistant; these are
 * the human steps around them: look at the draft, make it live, throw it away, or go
 * back to an earlier version.
 */

const btn =
  "inline-flex items-center gap-1.5 rounded-md border text-[12px] font-medium px-2.5 min-h-8 disabled:opacity-50";

export function PreviewLink({ path }: { path: string }) {
  return (
    <a
      href={`/api/website/preview?path=${encodeURIComponent(path === "@theme" ? "/" : path)}`}
      target="_blank"
      rel="noopener"
      className={`${btn} surface-2 hover:surface-3`}
    >
      <Eye size={12} />
      Preview
    </a>
  );
}

export function PublishButton({ path, label = "Publish" }: { path: string; label?: string }) {
  const a = useAction(publishSitePath, { refreshOnSuccess: true });
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={a.pending}
        onClick={() => {
          if (confirm(`Publish the changes to ${path === "@theme" ? "the theme" : path}? Visitors will see them straight away.`))
            a.run({ path });
        }}
        className={`${btn} bg-[var(--accent)] text-white border-transparent hover:opacity-90`}
      >
        <Upload size={12} />
        {a.pending ? "Publishing…" : label}
      </button>
      <FormError message={a.error} />
    </span>
  );
}

export function DiscardButton({ path }: { path: string }) {
  const a = useAction(discardSiteDraft, { refreshOnSuccess: true });
  return (
    <button
      type="button"
      disabled={a.pending}
      onClick={() => {
        if (confirm("Throw away the unpublished changes? The live page stays as it is.")) a.run({ path });
      }}
      className={`${btn} surface-2 hover:surface-3`}
    >
      <Undo2 size={12} />
      Discard
    </button>
  );
}

export type HistoryRow = {
  id: string;
  version: number;
  status: string;
  note: string | null;
  createdBy: string | null;
  publishedAt: string | null;
};

export function HistoryList({ rows }: { rows: HistoryRow[] }) {
  const a = useAction(restoreSiteVersion, { refreshOnSuccess: true });
  const [open, setOpen] = React.useState(false);
  if (!rows.length) return null;
  return (
    <div>
      <button type="button" onClick={() => setOpen(!open)} className={`${btn} surface-2 hover:surface-3`}>
        <History size={12} />
        History ({rows.length})
      </button>
      {open && (
        <ul className="mt-2 space-y-1.5">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-2 text-[12px]">
              <span className="font-mono text-3">v{r.version}</span>
              <span className="text-2 truncate">
                {r.note ?? "—"}
                {r.publishedAt ? ` · ${new Date(r.publishedAt).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}` : ""}
                {r.status === "published" ? " · live now" : ""}
              </span>
              {r.status !== "published" && (
                <button
                  type="button"
                  disabled={a.pending}
                  onClick={() => a.run({ id: r.id })}
                  className={`${btn} surface-2 hover:surface-3 ml-auto`}
                  title="Copy this version into the draft. Publish to make it live."
                >
                  <RotateCcw size={11} />
                  Restore
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <FormError message={a.error} />
    </div>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Printer, RotateCcw, Trash2, ImagePlus, Loader2 } from "lucide-react";
import { ActionButton, ConfirmButton, Modal } from "@/components/forms/action-form";
import { rerunBuildingCheck, deleteBuildingCheck } from "@/server/actions/building-checks";
import type { CheckResult } from "@/server/building-check/run";
import { PhotoPicker, type PickedPhoto } from "./photo-picker";

/** The building-check report's interactive parts: filters, actions, live status. */

const SEV = {
  red: { label: "RED", bar: "#C0391B" },
  amber: { label: "AMBER", bar: "#D98A00" },
  green: { label: "GREEN", bar: "#2E8B57" },
} as const;
const CONF = {
  confirmed: { label: "Confirmed", cls: "bg-[#E3F6EE] text-[#0B7A55]" },
  likely: { label: "Likely", cls: "bg-[#EEF3FF] text-[#0034C8]" },
  needs_verification: { label: "Needs verification", cls: "bg-[#FFF4E5] text-[#8A4B00]" },
} as const;

const aud = (n: number) => `$${n.toLocaleString("en-AU")}`;

/** While the check is queued or running, refresh until it lands. */
export function LiveStatus({ status }: { status: string }) {
  const router = useRouter();
  React.useEffect(() => {
    if (status !== "queued" && status !== "running") return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [status, router]);
  if (status !== "queued" && status !== "running") return null;
  return (
    <div role="status" className="rounded-xl surface-2 border p-6 flex items-center gap-3">
      <Loader2 className="animate-spin text-[var(--accent)]" size={22} />
      <div>
        <p className="font-semibold text-[15px]">{status === "queued" ? "Queued…" : "Reading every photo…"}</p>
        <p className="text-2 text-[13px]">Usually about a minute. This page updates by itself; you can leave and come back.</p>
      </div>
    </div>
  );
}

export function Findings({ checkId, result }: { checkId: string; result: CheckResult }) {
  const [filter, setFilter] = React.useState<"all" | "red" | "amber" | "green" | "verify">("all");
  const n = (s: "red" | "amber" | "green") => result.findings.filter((f) => f.severity === s).length;
  const verify = result.findings.filter((f) => f.confidence === "needs_verification").length;
  const shown = result.findings.filter((f) =>
    filter === "all" ? true : filter === "verify" ? f.confidence === "needs_verification" : f.severity === filter,
  );
  const chips = [
    { key: "all", label: `All ${result.findings.length}` },
    { key: "red", label: `Red ${n("red")}` },
    { key: "amber", label: `Amber ${n("amber")}` },
    { key: "green", label: `Green ${n("green")}` },
    { key: "verify", label: `Needs verification ${verify}` },
  ] as const;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5 print:hidden" role="tablist">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={filter === c.key}
            onClick={() => setFilter(c.key)}
            className={`rounded-full px-3 min-h-8 text-[12.5px] ${filter === c.key ? "bg-[#13254A] text-white" : "surface-2 border hover:surface-3"}`}
          >
            {c.label}
          </button>
        ))}
      </div>
      {n("red") === 0 && filter !== "amber" && filter !== "green" && (
        <p className="rounded-lg border border-[#BFE5CF] bg-[#E8F6EE] p-3 text-[13.5px] text-[#1B4F33]">
          <strong>No red flags</strong> from these photos. That is a finding in itself; see the gaps below.
        </p>
      )}
      {shown.map((f, i) => (
        <article
          key={`${f.issue}-${i}`}
          className="surface-2 border rounded-xl p-4 grid grid-cols-[84px_1fr] sm:grid-cols-[110px_1fr] gap-4 break-inside-avoid"
          style={{ borderLeft: `5px solid ${SEV[f.severity].bar}` }}
        >
          <div className="space-y-1">
            {f.photos.slice(0, 2).map((p) => (
              <a key={p} href={`/api/building-checks/${checkId}/photos/${p}`} target="_blank" rel="noopener noreferrer" className="block relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-gated photo route */}
                <img
                  src={`/api/building-checks/${checkId}/photos/${p}`}
                  alt={`Photo ${p}`}
                  loading="lazy"
                  className="w-full aspect-[4/3] object-cover rounded-md border"
                />
                <span className="absolute bottom-1 left-1 rounded bg-[#13254A]/85 text-white text-[10px] px-1">Photo {p}</span>
              </a>
            ))}
            {f.photos.length === 0 && <div className="aspect-[4/3] rounded-md border border-dashed text-3 text-[10.5px] grid place-items-center text-center p-1">not photographed</div>}
          </div>
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10.5px] font-extrabold tracking-wider rounded px-1.5 py-0.5 text-white" style={{ background: SEV[f.severity].bar }}>
                {SEV[f.severity].label}
              </span>
              <strong className="text-[15px]">{f.issue}</strong>
              <span className="text-2 text-[12.5px]">· {f.location}</span>
              <span className={`ml-auto rounded-full px-2 py-0.5 text-[11.5px] ${CONF[f.confidence].cls}`}>{CONF[f.confidence].label}</span>
            </div>
            <p className="text-[13.5px] leading-relaxed">{f.reading}</p>
            {f.verify && <p className="text-[12.5px] text-[#8A4B00]">To confirm: {f.verify}</p>}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px]">
              {f.costLow != null && (
                <span>
                  <strong>
                    {aud(f.costLow)}
                    {f.costHigh != null && f.costHigh !== f.costLow ? ` – ${aud(f.costHigh)}` : ""}
                  </strong>
                  {f.costDriver && <span className="text-2"> · {f.costDriver}</span>}
                </span>
              )}
              <span className="text-[var(--accent)] font-semibold">→ {f.action}</span>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function ReportActions({ checkId, status }: { checkId: string; status: string }) {
  const router = useRouter();
  const [adding, setAdding] = React.useState(false);
  const [photos, setPhotos] = React.useState<PickedPhoto[]>([]);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const running = status === "queued" || status === "running";

  async function upload() {
    if (!photos.length) return;
    setSending(true);
    setError(null);
    const form = new FormData();
    for (const p of photos) {
      form.append("files", new File([p.blob], p.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }));
      form.append("areas", p.area);
    }
    const r = await fetch(`/api/building-checks/${checkId}/photos`, { method: "POST", body: form });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    setSending(false);
    if (!r.ok) return setError(j.error ?? "The photos could not be added.");
    setAdding(false);
    setPhotos([]);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-1.5 print:hidden">
      <button
        type="button"
        disabled={running}
        onClick={() => setAdding(true)}
        className="inline-flex items-center gap-1.5 text-[13px] px-3 min-h-9 rounded-md surface-2 border hover:surface-3 disabled:opacity-50"
      >
        <ImagePlus size={14} /> Add photos &amp; re-run
      </button>
      {status === "done" && (
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 text-[13px] px-3 min-h-9 rounded-md bg-[var(--accent)] text-white font-medium"
        >
          <Printer size={14} /> Print / save PDF
        </button>
      )}
      {!running && (
        <ActionButton action={rerunBuildingCheck} input={{ id: checkId }} title="Run again over the same photos">
          <RotateCcw size={12} /> Re-run
        </ActionButton>
      )}
      <ConfirmButton
        action={deleteBuildingCheck}
        input={{ id: checkId }}
        confirmLabel="Delete the check and its photos"
        onDone={() => router.push("/building-checks")}
      >
        <Trash2 size={12} /> Delete
      </ConfirmButton>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add photos and re-run" wide>
        <div className="space-y-3">
          <p className="text-2 text-[13px]">Add what the check said was missing; it will run again over all the photos.</p>
          <PhotoPicker photos={photos} setPhotos={setPhotos} />
          {error && <p role="alert" className="text-[12.5px] text-[#b02f2f]">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAdding(false)} className="text-[13px] px-3 min-h-9 rounded-md surface-2 border">
              Cancel
            </button>
            <button
              type="button"
              disabled={!photos.length || sending}
              onClick={upload}
              className="text-[13px] px-3 min-h-9 rounded-md bg-[var(--accent)] text-white font-medium disabled:opacity-50"
            >
              {sending ? "Uploading…" : `Add ${photos.length || ""} and re-run`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

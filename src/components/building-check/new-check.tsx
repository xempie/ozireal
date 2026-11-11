"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CONTEXTS } from "@/lib/building-check";
import { PhotoPicker, type PickedPhoto } from "./photo-picker";

type Option = { value: string; label: string };

/**
 * Start a building check: photos, who it is for, an optional property, notes, Run.
 * Nothing is pre-chosen for "who it is for" (owner's rule for this CRM's forms): the
 * context changes what the check focuses on, so it is a deliberate choice.
 */
export function NewBuildingCheck({ properties, presetProperty }: { properties: Option[]; presetProperty?: string }) {
  const router = useRouter();
  const [photos, setPhotos] = React.useState<PickedPhoto[]>([]);
  const [context, setContext] = React.useState<string | null>(null);
  const [propertyId, setPropertyId] = React.useState(presetProperty ?? "");
  const [label, setLabel] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function run() {
    setError(null);
    if (!photos.length) return setError("Add at least one photo.");
    if (!context) return setError("Choose who the check is for.");
    setSending(true);
    try {
      const form = new FormData();
      form.set("context", context);
      if (propertyId) form.set("propertyId", propertyId);
      else if (label.trim()) form.set("label", label.trim());
      if (notes.trim()) form.set("notes", notes.trim());
      for (const p of photos) {
        form.append("files", new File([p.blob], p.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }));
        form.append("areas", p.area);
      }
      const r = await fetch("/api/building-checks", { method: "POST", body: form });
      const j = (await r.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!r.ok || !j.id) throw new Error(j.error ?? "The check could not be started. Try again.");
      router.push(`/building-checks/${j.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The check could not be started.");
      setSending(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-[1.55fr_1fr] gap-5 items-start">
      <section className="surface-2 border rounded-xl p-4 sm:p-5 space-y-3">
        <h2 className="text-[14px] font-semibold">1 · Photos</h2>
        <PhotoPicker photos={photos} setPhotos={setPhotos} />
      </section>

      <div className="space-y-5">
        <section className="surface-2 border rounded-xl p-4 sm:p-5 space-y-2.5">
          <h2 className="text-[14px] font-semibold">2 · Who is it for?</h2>
          {CONTEXTS.map((c) => (
            <label
              key={c.key}
              className={`flex gap-2.5 items-start rounded-lg p-3 cursor-pointer text-[13.5px] ${
                context === c.key ? "border-2 border-[var(--accent)] bg-[var(--accent)]/[0.05]" : "border hover:surface-3"
              }`}
            >
              <input type="radio" name="context" className="mt-1" checked={context === c.key} onChange={() => setContext(c.key)} />
              <span>
                <strong>{c.title}</strong>
                <span className="block text-2 text-[12.5px]">{c.note}</span>
              </span>
            </label>
          ))}
        </section>

        <section className="surface-2 border rounded-xl p-4 sm:p-5 space-y-2.5">
          <h2 className="text-[14px] font-semibold">
            3 · Which property? <span className="font-normal text-2">(optional)</span>
          </h2>
          <select
            aria-label="Property"
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            className="w-full surface-2 border rounded-md px-2.5 py-2 text-[16px] sm:text-[13.5px]"
          >
            <option value="">Not one of my properties</option>
            {properties.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          {!propertyId && (
            <input
              aria-label="Address or name for this check"
              placeholder="Address or a name, e.g. Buyer shortlist: 4 Rose St"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full surface-2 border rounded-md px-2.5 py-2 text-[16px] sm:text-[13.5px]"
            />
          )}
          <label className="block text-[12.5px] text-2">
            Anything we should know?
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Built c.1965. Buyer worried about the cracks in the lounge."
              className="mt-1 w-full surface-2 border rounded-md px-2.5 py-2 text-[16px] sm:text-[13.5px]"
            />
          </label>
        </section>

        {error && (
          <p role="alert" className="text-[13px] text-[#b02f2f]">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={run}
          disabled={sending}
          className="w-full min-h-13 py-3.5 rounded-xl bg-[var(--accent)] text-white text-[15.5px] font-bold disabled:opacity-60"
        >
          {sending ? `Uploading ${photos.length} photos…` : `Run building check${photos.length ? ` (${photos.length} photos)` : ""} →`}
        </button>
        <p className="text-center text-3 text-[12px]">Takes about a minute. The AI cost is logged under Costs.</p>
      </div>
    </div>
  );
}

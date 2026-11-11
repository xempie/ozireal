"use client";

import * as React from "react";
import { Camera, ImagePlus, X } from "lucide-react";
import { AREAS, KEY_AREAS } from "@/lib/building-check";

/**
 * Photos for a building check: the phone's rear camera ("Take photo", one at a time
 * while walking the property) or the library (many at once). Each photo is shrunk in
 * the browser to 1600px and re-encoded as JPEG, which keeps uploads fast on mobile data
 * and strips the camera's location data. An optional area tag per photo feeds the
 * coverage bar, so the gaps that hide expensive problems show before the check runs.
 */

export type PickedPhoto = { id: string; blob: Blob; url: string; name: string; area: string };

const MAX_EDGE = 1600;

async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
  if (!blob) throw new Error("could not encode");
  return blob;
}

export function PhotoPicker({
  photos,
  setPhotos,
  max = 40,
}: {
  photos: PickedPhoto[];
  setPhotos: React.Dispatch<React.SetStateAction<PickedPhoto[]>>;
  max?: number;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const camera = React.useRef<HTMLInputElement>(null);
  const library = React.useRef<HTMLInputElement>(null);

  async function add(list: FileList | null) {
    if (!list?.length) return;
    setError(null);
    const room = max - photos.length;
    const files = Array.from(list).slice(0, Math.max(0, room));
    if (list.length > room) setError(`Up to ${max} photos per check; the extra ones were left out.`);
    setBusy(true);
    try {
      const next: PickedPhoto[] = [];
      for (const f of files) {
        try {
          const blob = await shrink(f);
          next.push({ id: crypto.randomUUID(), blob, url: URL.createObjectURL(blob), name: f.name || "photo.jpg", area: "" });
        } catch {
          setError(`${f.name} could not be read. HEIC from an older phone? Try "Take photo" instead.`);
        }
      }
      setPhotos((p) => [...p, ...next]);
    } finally {
      setBusy(false);
      if (camera.current) camera.current.value = "";
      if (library.current) library.current.value = "";
    }
  }

  const covered = new Set(photos.map((p) => p.area).filter(Boolean));
  const keyAreas = AREAS.filter((a) => (KEY_AREAS as readonly string[]).includes(a.key));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => camera.current?.click()}
          className="min-h-12 rounded-lg bg-[var(--accent)] text-white font-semibold text-[14px] inline-flex items-center justify-center gap-2"
        >
          <Camera size={18} /> Take photo
        </button>
        <button
          type="button"
          onClick={() => library.current?.click()}
          className="min-h-12 rounded-lg surface-2 border font-semibold text-[14px] inline-flex items-center justify-center gap-2 hover:surface-3"
        >
          <ImagePlus size={18} /> Choose photos
        </button>
        {/* capture opens the rear camera on a phone; on a computer it is a file picker. */}
        <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => add(e.target.files)} />
        <input ref={library} type="file" accept="image/*" multiple hidden onChange={(e) => add(e.target.files)} />
      </div>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          add(e.dataTransfer.files);
        }}
        className="hidden sm:block rounded-lg border-2 border-dashed p-4 text-center text-[12.5px] text-2"
      >
        {busy ? "Preparing photos…" : "…or drop photos here"} · up to {max}
      </div>
      {busy && <p className="sm:hidden text-[12.5px] text-2">Preparing photos…</p>}
      {error && <p role="alert" className="text-[12.5px] text-[#b02f2f]">{error}</p>}

      {photos.length > 0 && (
        <ul className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {photos.map((p, i) => (
            <li key={p.id} className="space-y-1">
              <div className="relative aspect-[4/3] rounded-md overflow-hidden border surface-1">
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                <img src={p.url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                <span className="absolute top-1 left-1 rounded bg-[#13254A]/85 text-white text-[10.5px] px-1.5">{i + 1}</span>
                <button
                  type="button"
                  aria-label={`Remove photo ${i + 1}`}
                  onClick={() => {
                    URL.revokeObjectURL(p.url);
                    setPhotos((all) => all.filter((x) => x.id !== p.id));
                  }}
                  className="absolute top-1 right-1 size-7 rounded-full bg-black/60 text-white inline-flex items-center justify-center"
                >
                  <X size={14} />
                </button>
              </div>
              <select
                aria-label={`Area for photo ${i + 1}`}
                value={p.area}
                onChange={(e) => setPhotos((all) => all.map((x) => (x.id === p.id ? { ...x, area: e.target.value } : x)))}
                className="w-full surface-2 border rounded px-1 py-1 text-[16px] sm:text-[11.5px]"
              >
                <option value="">Area…</option>
                {AREAS.map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.label}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-1.5 rounded-md p-2.5 bg-[#FFF7E0] text-[12px] text-[#6B4A00]">
        <strong className="mr-1">Coverage:</strong>
        {keyAreas.map((a) => {
          const ok = covered.has(a.key);
          return (
            <span
              key={a.key}
              className={`rounded-full px-2 py-0.5 ${ok ? "bg-[#E3F6EE] text-[#0B7A55]" : "bg-[#FDECEA] text-[#A12A12]"}`}
            >
              {ok ? "✓" : "✗"} {a.label}
            </span>
          );
        })}
        <span className="basis-full sm:basis-auto">Tag each photo&rsquo;s area; red ones are where expensive problems hide.</span>
      </div>
    </div>
  );
}

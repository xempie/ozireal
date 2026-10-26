"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Star, ChevronLeft, ChevronRight, Trash2, LayoutGrid } from "lucide-react";
import { useAction, FormError } from "./action-form";
import {
  setMainListingPhoto,
  moveListingPhoto,
  updateListingPhoto,
  deleteListingPhoto,
} from "@/server/actions/media";

/**
 * A listing's photos: add several at once (pick or drag in), choose the main photo, put
 * them in order, describe them, mark a floor plan, delete.
 *
 * Each photo is resized in the browser before it is sent: the long edge is capped at
 * 2400px and it is re-encoded as WebP (JPEG where the browser cannot write WebP). That
 * keeps a 6 MB phone photo to a few hundred KB, and re-encoding drops the camera's EXIF,
 * so a photo never publishes where the camera was standing.
 */

export type ListingPhoto = { id: string; url: string; kind: "photo" | "floorplan" | "video"; altText: string | null };

const MAX_EDGE = 2400;
const BATCH = 5;

async function prepare(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const toBlob = (type: string, q: number) =>
    new Promise<Blob | null>((res) => canvas.toBlob(res, type, q));
  const webp = await toBlob("image/webp", 0.85);
  if (webp && webp.type === "image/webp") return webp;
  const jpg = await toBlob("image/jpeg", 0.86);
  if (!jpg) throw new Error("encode failed");
  return jpg;
}

export function ListingPhotos({ listingId, photos }: { listingId: string; photos: ListingPhoto[] }) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [drag, setDrag] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  // The main photo is the first one that is a photo; a floor plan never leads.
  const mainId = photos.find((p) => p.kind === "photo")?.id;

  async function upload(list: FileList | File[]) {
    const files = Array.from(list).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    if (!files.length) {
      setError("Choose photo files (JPG, PNG, WebP or iPhone photos).");
      return;
    }
    setError(null);
    setBusy(true);
    const failed: string[] = [];
    let done = 0;
    try {
      for (let i = 0; i < files.length; i += BATCH) {
        const form = new FormData();
        for (const f of files.slice(i, i + BATCH)) {
          setStatus(`Preparing ${Math.min(done + 1, files.length)} of ${files.length}…`);
          try {
            const blob = await prepare(f);
            const ext = blob.type === "image/webp" ? "webp" : "jpg";
            form.append("files", blob, f.name.replace(/\.[^.]+$/, "") + "." + ext);
          } catch {
            failed.push(f.name);
          }
          done++;
        }
        if (!form.getAll("files").length) continue;
        setStatus(`Uploading ${Math.min(done, files.length)} of ${files.length}…`);
        const r = await fetch(`/api/media/listings/${listingId}`, { method: "POST", body: form });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          setError(j.error ?? "Some photos could not be uploaded.");
          break;
        }
      }
      if (failed.length) {
        setError(
          `${failed.length === 1 ? failed[0] + " could" : failed.length + " photos could"} not be read. ` +
            "Try saving it as JPG first (iPhone: Settings → Camera → Formats → Most Compatible).",
        );
      }
    } catch {
      setError("The upload stopped. Check your connection and try again.");
    } finally {
      setBusy(false);
      setStatus(null);
      router.refresh();
    }
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (!busy) upload(e.dataTransfer.files);
        }}
        className={`rounded-lg border-2 border-dashed p-5 text-center transition-colors ${
          drag ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--line-strong)]"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) upload(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-md bg-[var(--accent)] text-white text-[13px] font-medium px-3.5 min-h-10 hover:opacity-90 disabled:opacity-60"
        >
          <ImagePlus size={15} />
          {busy ? status ?? "Uploading…" : "Add photos"}
        </button>
        <p className="text-3 text-[12px] mt-2">
          Choose several at once, or drag them here. {photos.length === 0 && "The first one becomes the main photo."}
        </p>
      </div>

      {error && (
        <div className="mt-3">
          <FormError message={error} />
        </div>
      )}

      {photos.length > 0 && (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
          {photos.map((p, i) => (
            <PhotoTile key={p.id} p={p} main={p.id === mainId} first={i === 0} last={i === photos.length - 1} />
          ))}
        </ul>
      )}
    </div>
  );
}

const iconBtn =
  "inline-flex items-center justify-center rounded-md border surface-2 hover:surface-3 min-h-8 min-w-8 px-1.5 text-[11.5px] gap-1 disabled:opacity-40";

function PhotoTile({ p, main, first, last }: { p: ListingPhoto; main: boolean; first: boolean; last: boolean }) {
  const opts = { refreshOnSuccess: true };
  const setMain = useAction(setMainListingPhoto, opts);
  const move = useAction(moveListingPhoto, opts);
  const update = useAction(updateListingPhoto, opts);
  const del = useAction(deleteListingPhoto, opts);
  const [alt, setAlt] = React.useState(p.altText ?? "");
  const pending = setMain.pending || move.pending || update.pending || del.pending;
  const error = setMain.error ?? move.error ?? update.error ?? del.error;

  return (
    <li className={`rounded-lg border overflow-hidden ${main ? "ring-2 ring-[var(--accent)]" : ""} ${pending ? "opacity-60" : ""}`}>
      <div className="relative aspect-[4/3] bg-[var(--surface-2,#eee)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- console thumbnail of our own upload */}
        <img src={p.url} alt={p.altText ?? ""} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
        {main && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded bg-[var(--accent)] text-white text-[11px] font-medium px-1.5 py-0.5">
            <Star size={10} fill="currentColor" /> Main photo
          </span>
        )}
        {p.kind === "floorplan" && (
          <span className="absolute top-2 right-2 rounded bg-black/70 text-white text-[11px] px-1.5 py-0.5">Floor plan</span>
        )}
      </div>
      <div className="p-2 space-y-2">
        <input
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
          onBlur={() => alt !== (p.altText ?? "") && update.run({ id: p.id, altText: alt })}
          placeholder="Describe the photo (e.g. North-facing back garden)"
          maxLength={200}
          className="w-full rounded-md border surface-1 px-2 min-h-8 text-[12px]"
        />
        <div className="flex flex-wrap gap-1">
          {!main && p.kind === "photo" && (
            <button type="button" disabled={pending} onClick={() => setMain.run({ id: p.id })} className={iconBtn} title="Show this photo first, on the home page and listing cards">
              <Star size={12} /> Make main
            </button>
          )}
          <button type="button" disabled={pending || first} onClick={() => move.run({ id: p.id, direction: "earlier" })} className={iconBtn} aria-label="Move earlier">
            <ChevronLeft size={13} />
          </button>
          <button type="button" disabled={pending || last} onClick={() => move.run({ id: p.id, direction: "later" })} className={iconBtn} aria-label="Move later">
            <ChevronRight size={13} />
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => update.run({ id: p.id, kind: p.kind === "floorplan" ? "photo" : "floorplan" })}
            className={iconBtn}
            title={p.kind === "floorplan" ? "Mark as a photo" : "Mark as the floor plan"}
          >
            <LayoutGrid size={12} /> {p.kind === "floorplan" ? "Photo" : "Floor plan"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => confirm("Delete this photo?") && del.run({ id: p.id })}
            className={`${iconBtn} ml-auto text-[#b02f2f]`}
            aria-label="Delete photo"
          >
            <Trash2 size={12} />
          </button>
        </div>
        <FormError message={error} />
      </div>
    </li>
  );
}

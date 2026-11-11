import { randomUUID } from "node:crypto";
import { putMedia, sniffImage } from "@/server/media/s3";

/**
 * Building-check photos: PRIVATE, unlike listing photos. They may show inside a client's
 * home or a house the agency does not hold, so they live under t/<tenant>/c/<check>/…,
 * which the public /media route refuses (it serves listing keys only), and are read back
 * only by the signed-in photo route and the worker.
 */

export const MAX_PHOTOS = 40;
const MAX_BYTES = 8 * 1024 * 1024;

export const CHECK_PHOTO_RE = /^t\/[0-9a-f-]{36}\/c\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webp|jpg|png)$/;

export type PreparedPhoto = { key: string; bytes: Uint8Array; type: string; name: string };

/** Check every file is a real image under the size limit; nothing is stored yet. */
export async function preparePhotos(
  tenantId: string,
  checkId: string,
  files: File[],
): Promise<{ ok: true; photos: PreparedPhoto[] } | { ok: false; error: string; status: number }> {
  const photos: PreparedPhoto[] = [];
  for (const f of files) {
    if (f.size > MAX_BYTES) return { ok: false, error: `${f.name} is larger than 8 MB.`, status: 413 };
    const bytes = new Uint8Array(await f.arrayBuffer());
    const kind = sniffImage(bytes);
    if (!kind) return { ok: false, error: `${f.name} is not a JPG, PNG or WebP photo.`, status: 415 };
    photos.push({ key: `t/${tenantId}/c/${checkId}/${randomUUID()}.${kind.ext}`, bytes, type: kind.type, name: f.name.slice(0, 120) });
  }
  return { ok: true, photos };
}

export async function storePhotos(photos: PreparedPhoto[]) {
  for (const p of photos) await putMedia(p.key, p.bytes, p.type);
}

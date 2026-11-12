/**
 * Images for the assistant: screenshots pasted, photos taken or files dropped.
 * Shrunk in the browser (long edge 1568 px, JPEG) so a phone photo is ~200 KB, not 5 MB,
 * and the model reads it at full useful resolution.
 */

export type Attachment = { media_type: "image/jpeg"; data: string; preview: string; name: string };

const MAX_EDGE = 1568;
export const MAX_ATTACHMENTS = 4;

export async function toAttachment(file: File | Blob, name = "image"): Promise<Attachment | null> {
  if (!file.type.startsWith("image/")) return null;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = fail;
      i.src = url;
    });
    const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    return { media_type: "image/jpeg", data: dataUrl.split(",")[1], preview: dataUrl, name };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Images from a paste or a drop. Returns [] when there are none (plain text paste). */
export async function attachmentsFrom(items: DataTransferItemList | FileList | null): Promise<Attachment[]> {
  if (!items) return [];
  const files: File[] = [];
  for (const it of Array.from(items as ArrayLike<DataTransferItem | File>)) {
    const f = it instanceof File ? it : it.kind === "file" ? it.getAsFile() : null;
    if (f && f.type.startsWith("image/")) files.push(f);
  }
  const out = await Promise.all(files.slice(0, MAX_ATTACHMENTS).map((f) => toAttachment(f, f.name || "screenshot")));
  return out.filter((a): a is Attachment => a !== null);
}

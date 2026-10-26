import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { env } from "@/env";

/**
 * Listing photos in S3: a private bucket in ap-southeast-2 (rule 6), reached with the
 * instance role, so there is no key to store. Visitors never see the bucket; photos are
 * served through /media/<key> by the app, which next/image then resizes and caches.
 *
 * Keys: t/<tenantId>/l/<listingId>/<uuid>.<ext>. The uuid makes a key unguessable and
 * immutable, so a photo can be cached forever and a replacement is a new key.
 */

let client: S3Client | null = null;
function s3() {
  client ??= new S3Client({ region: env.AWS_REGION });
  return client;
}

export function mediaBucket(): string {
  if (!env.S3_BUCKET) throw new Error("S3_BUCKET is not set, so photos cannot be stored.");
  return env.S3_BUCKET;
}

export const MEDIA_KEY_RE =
  /^t\/[0-9a-f-]{36}\/l\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webp|jpg|png)$/;

export const mediaUrl = (key: string) => `/media/${key}`;

export async function putMedia(key: string, body: Uint8Array, contentType: string) {
  await s3().send(
    new PutObjectCommand({
      Bucket: mediaBucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
}

export async function getMedia(key: string) {
  const r = await s3().send(new GetObjectCommand({ Bucket: mediaBucket(), Key: key }));
  return { body: r.Body, contentType: r.ContentType ?? "application/octet-stream", length: r.ContentLength };
}

export async function deleteMedia(key: string) {
  await s3().send(new DeleteObjectCommand({ Bucket: mediaBucket(), Key: key }));
}

/** What the bytes actually are, from their first bytes. The browser's word is not enough. */
export function sniffImage(b: Uint8Array): { ext: "jpg" | "png" | "webp"; type: string } | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", type: "image/jpeg" };
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: "png", type: "image/png" };
  if (
    b.length > 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  )
    return { ext: "webp", type: "image/webp" };
  return null;
}

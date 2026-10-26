import { asc, eq } from "drizzle-orm";
import { query } from "@/db";
import { listingMedia } from "@/db/schema";
import { mediaUrl } from "@/server/media/s3";

/** A listing's photos in display order. The first is the main photo. */
export async function getListingPhotos(listingId: string) {
  const rows = await query((tx) =>
    tx
      .select({
        id: listingMedia.id,
        s3Key: listingMedia.s3Key,
        kind: listingMedia.kind,
        altText: listingMedia.altText,
      })
      .from(listingMedia)
      .where(eq(listingMedia.listingId, listingId))
      .orderBy(asc(listingMedia.sortOrder), asc(listingMedia.createdAt)),
  );
  return rows.map((r) => ({ id: r.id, url: mediaUrl(r.s3Key), kind: r.kind, altText: r.altText }));
}

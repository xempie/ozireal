import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { withTenant } from "@/db";
import { listings, listingMedia, auditLog } from "@/db/schema";
import { putMedia, deleteMedia, sniffImage, mediaUrl } from "@/server/media/s3";

/**
 * Upload listing photos. Several files per request, from the listing's Photos section.
 *
 * The browser has already resized each photo and re-encoded it, which also strips the
 * camera's EXIF (including GPS). Here the bytes are checked to really be an image, the
 * listing is checked to be this tenant's (RLS), and each file is stored then recorded.
 * The first photo a listing gets becomes its main photo.
 */

const MAX_FILES = 20;
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_PER_LISTING = 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "You are signed out." }, { status: 401 });
  const tenantId = session.user.tenantId;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Unknown listing." }, { status: 404 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "That upload could not be read." }, { status: 400 });
  }
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (!files.length) return NextResponse.json({ error: "No photos were attached." }, { status: 400 });
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Up to ${MAX_FILES} photos at a time.` }, { status: 400 });
  }

  const prepared: { key: string; bytes: Uint8Array; type: string; name: string }[] = [];
  for (const f of files) {
    if (f.size > MAX_BYTES) {
      return NextResponse.json({ error: `${f.name} is larger than 8 MB.` }, { status: 413 });
    }
    const bytes = new Uint8Array(await f.arrayBuffer());
    const kind = sniffImage(bytes);
    if (!kind) {
      return NextResponse.json({ error: `${f.name} is not a JPG, PNG or WebP photo.` }, { status: 415 });
    }
    prepared.push({
      key: `t/${tenantId}/l/${id.toLowerCase()}/${randomUUID()}.${kind.ext}`,
      bytes,
      type: kind.type,
      name: f.name,
    });
  }

  try {
    const result = await withTenant(tenantId, async (tx) => {
      const [l] = await tx.select({ id: listings.id }).from(listings).where(eq(listings.id, id));
      if (!l) return { error: "Unknown listing.", status: 404 } as const;

      const [{ n, maxSort }] = await tx
        .select({
          n: sql<number>`count(*)::int`,
          maxSort: sql<number>`coalesce(max(${listingMedia.sortOrder}), -1)::int`,
        })
        .from(listingMedia)
        .where(and(eq(listingMedia.listingId, id)));
      if (n + prepared.length > MAX_PER_LISTING) {
        return { error: `A listing can have up to ${MAX_PER_LISTING} photos.`, status: 400 } as const;
      }

      // Stored first, recorded second: a failed upload leaves no row pointing at nothing.
      for (const p of prepared) await putMedia(p.key, p.bytes, p.type);

      const rows = await tx
        .insert(listingMedia)
        .values(
          prepared.map((p, i) => ({
            tenantId,
            listingId: id,
            s3Key: p.key,
            kind: "photo" as const,
            sortOrder: maxSort + 1 + i,
            altText: null,
          })),
        )
        .returning({ id: listingMedia.id, s3Key: listingMedia.s3Key });

      await tx.insert(auditLog).values({
        tenantId,
        actorUserId: session.user.id,
        actorLabel: session.user.name ?? "Unknown",
        kind: "edit",
        action: `Added ${rows.length} listing photo${rows.length === 1 ? "" : "s"}`,
        target: id,
        entityType: "listing",
        entityId: id,
      });
      return { rows } as const;
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({
      ok: true,
      photos: result.rows.map((r) => ({ id: r.id, url: mediaUrl(r.s3Key) })),
    });
  } catch (e) {
    console.error("[media] upload failed:", e instanceof Error ? e.message : e);
    // Best effort: remove anything stored before the failure.
    await Promise.allSettled(prepared.map((p) => deleteMedia(p.key)));
    return NextResponse.json({ error: "The photos could not be saved. Try again." }, { status: 500 });
  }
}

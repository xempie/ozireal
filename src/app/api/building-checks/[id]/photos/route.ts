import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { withTenant } from "@/db";
import { buildingChecks, auditLog } from "@/db/schema";
import { deleteMedia } from "@/server/media/s3";
import { enqueue } from "@/server/jobs/queues";
import { AREAS } from "@/lib/building-check";
import { MAX_PHOTOS, preparePhotos, storePhotos } from "@/server/building-check/store";

/**
 * "Add photos & re-run": more photos on an existing check, then the check runs again
 * over all of them (the gaps it named are usually what gets added).
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AREA_KEYS = new Set<string>(AREAS.map((a) => a.key));

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "You are signed out." }, { status: 401 });
  const tenantId = session.user.tenantId;
  const { id } = await params;
  if (!UUID.test(id)) return NextResponse.json({ error: "Unknown check." }, { status: 404 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "That upload could not be read." }, { status: 400 });
  }
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  const areas = form.getAll("areas").map((a) => (typeof a === "string" && AREA_KEYS.has(a) ? a : null));
  if (!files.length) return NextResponse.json({ error: "Add at least one photo." }, { status: 400 });

  const prepared = await preparePhotos(tenantId, id.toLowerCase(), files);
  if (!prepared.ok) return NextResponse.json({ error: prepared.error }, { status: prepared.status });

  try {
    const result = await withTenant(tenantId, async (tx) => {
      const [c] = await tx
        .select({ photos: buildingChecks.photos, status: buildingChecks.status })
        .from(buildingChecks)
        .where(eq(buildingChecks.id, id));
      if (!c) return { error: "Unknown check.", status: 404 } as const;
      if (c.status === "queued" || c.status === "running") {
        return { error: "This check is still running. Add photos when it finishes.", status: 409 } as const;
      }
      if (c.photos.length + prepared.photos.length > MAX_PHOTOS) {
        return { error: `A check can have up to ${MAX_PHOTOS} photos.`, status: 400 } as const;
      }
      await storePhotos(prepared.photos);
      await tx
        .update(buildingChecks)
        .set({
          photos: [...c.photos, ...prepared.photos.map((p, i) => ({ key: p.key, area: areas[i] ?? null, name: p.name }))],
          status: "queued",
          error: null,
        })
        .where(eq(buildingChecks.id, id));
      await tx.insert(auditLog).values({
        tenantId,
        actorUserId: session.user.id,
        actorLabel: session.user.name ?? "Unknown",
        kind: "edit",
        action: `Added ${prepared.photos.length} photos to a building check and re-ran it`,
        target: id,
        entityType: "building_check",
        entityId: id,
      });
      return { ok: true } as const;
    });
    if ("error" in result) {
      await Promise.allSettled(prepared.photos.map((p) => deleteMedia(p.key)));
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
  } catch (e) {
    console.error("[building-check] add photos failed:", e instanceof Error ? e.message : e);
    await Promise.allSettled(prepared.photos.map((p) => deleteMedia(p.key)));
    return NextResponse.json({ error: "The photos could not be saved. Try again." }, { status: 500 });
  }

  await enqueue("RunBuildingCheck", { tenantId, entityId: id.toLowerCase() });
  return NextResponse.json({ ok: true });
}

import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { withTenant } from "@/db";
import { buildingChecks, properties, auditLog, BUILDING_CHECK_CONTEXTS } from "@/db/schema";
import { deleteMedia } from "@/server/media/s3";
import { enqueue } from "@/server/jobs/queues";
import { AREAS } from "@/lib/building-check";
import { MAX_PHOTOS, preparePhotos, storePhotos } from "@/server/building-check/store";

/**
 * Start a building check: photos (multipart) plus who it is for, an optional property
 * and notes. Stores the photos privately, records the check, queues the job.
 * A route rather than a Server Action because it carries files (the listing photo
 * upload works the same way).
 */

const AREA_KEYS = new Set<string>(AREAS.map((a) => a.key));

const fields = z.object({
  context: z.enum(BUILDING_CHECK_CONTEXTS),
  propertyId: z.string().uuid().optional(),
  label: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) return NextResponse.json({ error: "You are signed out." }, { status: 401 });
  const tenantId = session.user.tenantId;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "That upload could not be read." }, { status: 400 });
  }
  const parsed = fields.safeParse({
    context: form.get("context") ?? undefined,
    propertyId: form.get("propertyId") || undefined,
    label: form.get("label") || undefined,
    notes: form.get("notes") || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose who the check is for." }, { status: 400 });
  }
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  const areas = form.getAll("areas").map((a) => (typeof a === "string" && AREA_KEYS.has(a) ? a : null));
  if (!files.length) return NextResponse.json({ error: "Add at least one photo." }, { status: 400 });
  if (files.length > MAX_PHOTOS) {
    return NextResponse.json({ error: `Up to ${MAX_PHOTOS} photos per check.` }, { status: 400 });
  }

  const checkId = randomUUID();
  const prepared = await preparePhotos(tenantId, checkId, files);
  if (!prepared.ok) return NextResponse.json({ error: prepared.error }, { status: prepared.status });

  try {
    const result = await withTenant(tenantId, async (tx) => {
      if (parsed.data.propertyId) {
        const [p] = await tx.select({ id: properties.id }).from(properties).where(eq(properties.id, parsed.data.propertyId));
        if (!p) return { error: "That property no longer exists.", status: 404 } as const;
      }
      // Stored first, recorded second: a failed upload leaves no row pointing at nothing.
      await storePhotos(prepared.photos);
      await tx.insert(buildingChecks).values({
        id: checkId,
        tenantId,
        propertyId: parsed.data.propertyId ?? null,
        label: parsed.data.label ?? null,
        context: parsed.data.context,
        notes: parsed.data.notes ?? null,
        photos: prepared.photos.map((p, i) => ({ key: p.key, area: areas[i] ?? null, name: p.name })),
        createdBy: session.user.id,
      });
      await tx.insert(auditLog).values({
        tenantId,
        actorUserId: session.user.id,
        actorLabel: session.user.name ?? "Unknown",
        kind: "edit",
        action: `Started a building check (${prepared.photos.length} photos)`,
        target: parsed.data.label ?? checkId,
        entityType: "building_check",
        entityId: checkId,
      });
      return { ok: true } as const;
    });
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  } catch (e) {
    console.error("[building-check] create failed:", e instanceof Error ? e.message : e);
    await Promise.allSettled(prepared.photos.map((p) => deleteMedia(p.key)));
    return NextResponse.json({ error: "The check could not be saved. Try again." }, { status: 500 });
  }

  await enqueue("RunBuildingCheck", { tenantId, entityId: checkId });
  return NextResponse.json({ ok: true, id: checkId });
}

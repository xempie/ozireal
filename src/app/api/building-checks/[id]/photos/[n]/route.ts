import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { withTenant } from "@/db";
import { buildingChecks } from "@/db/schema";
import { getMedia } from "@/server/media/s3";
import { CHECK_PHOTO_RE } from "@/server/building-check/store";

/**
 * One building-check photo, to signed-in staff of the same agency only (RLS on the
 * check row). Never cached publicly: these can show inside a client's home.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; n: string }> }) {
  const session = await auth();
  if (!session?.user?.tenantId) return new NextResponse("Signed out", { status: 401 });
  const { id, n } = await params;
  const index = Number(n) - 1;
  if (!UUID.test(id) || !Number.isInteger(index) || index < 0) return new NextResponse("Not found", { status: 404 });

  const [c] = await withTenant(session.user.tenantId, (tx) =>
    tx.select({ photos: buildingChecks.photos }).from(buildingChecks).where(eq(buildingChecks.id, id)).limit(1),
  );
  const key = c?.photos[index]?.key;
  if (!key || !CHECK_PHOTO_RE.test(key)) return new NextResponse("Not found", { status: 404 });

  const m = await getMedia(key);
  const body = m.body as { transformToWebStream?: () => ReadableStream } | undefined;
  if (!body?.transformToWebStream) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(body.transformToWebStream(), {
    headers: {
      "Content-Type": m.contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}

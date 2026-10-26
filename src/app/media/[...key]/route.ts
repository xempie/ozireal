import { NextResponse, type NextRequest } from "next/server";
import { getMedia, MEDIA_KEY_RE } from "@/server/media/s3";

/**
 * Serves a listing photo from the private bucket. Keys are random and never reused, so
 * the response is cached for a year. Only well-formed photo keys are fetched; anything
 * else is a 404 without touching S3.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const key = (await params).key.join("/");
  if (!MEDIA_KEY_RE.test(key)) return new NextResponse("Not found", { status: 404 });
  try {
    const m = await getMedia(key);
    if (!m.body) return new NextResponse("Not found", { status: 404 });
    const body = m.body as unknown as { transformToWebStream: () => ReadableStream };
    return new NextResponse(body.transformToWebStream(), {
      headers: {
        "content-type": m.contentType,
        "cache-control": "public, max-age=31536000, immutable",
        ...(m.length ? { "content-length": String(m.length) } : {}),
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}

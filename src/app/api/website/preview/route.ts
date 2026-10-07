import { draftMode } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { safePath } from "@/lib/safe-path";

/**
 * Turns on preview for a signed-in console user and sends them to the page, which then
 * renders its draft edits (src/server/public/content.ts). Draft mode is a signed cookie
 * Next issues; nobody without a session can get one from here.
 */


export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  (await draftMode()).enable();
  const path = safePath(req.nextUrl.searchParams.get("path"));
  return NextResponse.redirect(new URL(path, req.nextUrl.origin));
}

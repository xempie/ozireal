import { draftMode } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { safePath } from "@/lib/safe-path";

/** Leaves preview and shows the live version of the same page. */
export async function GET(req: NextRequest) {
  (await draftMode()).disable();
  const path = safePath(req.nextUrl.searchParams.get("path"));
  return NextResponse.redirect(new URL(path, req.nextUrl.origin));
}

import { NextResponse, type NextRequest } from "next/server";
import { readUnsubscribeToken, applyUnsubscribe } from "@/server/outbound/unsubscribe";

/**
 * Unsubscribe, by POST (2026-11-12): the page's button, and mail clients' one-click
 * List-Unsubscribe-Post (RFC 8058), which posts here with the token in the query.
 */
export async function POST(req: NextRequest) {
  let token = req.nextUrl.searchParams.get("t") ?? "";
  if (!token) {
    const form = await req.formData().catch(() => null);
    token = String(form?.get("t") ?? "");
  }
  const t = readUnsubscribeToken(token);
  if (!t) return NextResponse.json({ error: "This unsubscribe link is not valid." }, { status: 400 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const r = await applyUnsubscribe(t, ip);
  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("text/html")) {
    return NextResponse.redirect(new URL(`/unsubscribe?done=1`, req.nextUrl.origin), 303);
  }
  return NextResponse.json({ ok: r.ok });
}

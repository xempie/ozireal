import { auth } from "@/auth";
import { NextResponse } from "next/server";

/**
 * Nothing under the console is reachable without a session.
 *
 * Doing this in middleware rather than per page means a new screen is protected the
 * moment it exists - the failure mode of per-page checks is the page somebody forgets.
 */
export default auth((req) => {
  const isConsole = !["/login", "/"].includes(req.nextUrl.pathname);
  if (isConsole && !req.auth) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("from", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  /**
   * Everything except Next internals, the auth endpoints, static files, and the two
   * deliberately public intake routes (B3): the enquiry form and the SES webhook.
   * Those defend themselves — per-tenant key, signed token and rate limits on the
   * form; an SNS signature on the webhook. A session requirement here would just
   * mean no enquiry could ever arrive.
   */
  matcher: [
    "/((?!api/auth|api/forms|api/inbound|_next/static|_next/image|favicon.ico|robots.txt).*)",
  ],
};

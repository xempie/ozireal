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
  // Everything except Next internals, the auth endpoints themselves, and static files.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|robots.txt).*)"],
};

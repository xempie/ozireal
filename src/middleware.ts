import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

/**
 * Middleware builds its own Auth.js instance from the EDGE-SAFE config. Importing
 * `auth` from "@/auth" pulls in the password provider and therefore node:crypto,
 * which the Edge runtime cannot load — the build fails rather than the request.
 */
const { auth } = NextAuth(authConfig);
import { NextResponse } from "next/server";
import { isPrivatePath } from "@/lib/private-paths";

/**
 * The public/private split lives in a framework-free module so it can be tested
 * without pulling Auth.js and the Edge runtime into the test process.
 */
export { PRIVATE_PREFIXES, isPrivatePath } from "@/lib/private-paths";

/**
 * The host the public site is allowed to be indexed on.
 *
 * `www.ozirealty.com.au` is where the agency's search equity actually is — 51 posts and
 * four property pages, indexed for years. Serving the same pages on a second host and
 * letting Google index them creates a duplicate that competes with the real one, and the
 * migration plan exists specifically to avoid losing rankings. Until cutover the site is
 * visible on the CRM host so it can be reviewed, and told not to be indexed there.
 *
 * This is a header rather than a meta tag because it also covers sitemap.xml, robots.txt
 * and any future non-HTML response, none of which can carry a meta tag.
 */
const CANONICAL_HOST =
  process.env.PUBLIC_SITE_HOST ?? "www.ozirealty.com.au";

export default auth((req) => {
  if (isPrivatePath(req.nextUrl.pathname) && !req.auth) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("from", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();

  const host = req.headers.get("host")?.split(":")[0]?.toLowerCase();
  const isCanonical = host === CANONICAL_HOST;
  // localhost is nobody's crawl target, and tagging it would hide the header's
  // absence on a host where it genuinely matters.
  const isLocal = host === "localhost" || host === "127.0.0.1";

  if (!isCanonical && !isLocal) {
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return res;
});

export const config = {
  /**
   * Skips Next internals, the auth endpoints, and the deliberately public intake
   * routes (B3): the enquiry form and the inbound webhooks. Those defend themselves —
   * per-tenant key, signed token and rate limits on the form; an SNS signature on the
   * webhook. A session requirement there would just mean no enquiry could ever arrive.
   *
   * The public website is NOT excluded here — it runs through the middleware and is
   * allowed by `isPrivatePath` returning false. That keeps one decision in one place
   * rather than splitting it between a regex and a function.
   */
  matcher: [
    "/((?!api/auth|api/forms|api/inbound|_next/static|_next/image|favicon.ico).*)",
  ],
};

import { isPrivatePath } from "./private-paths";

/**
 * Which host serves what (CLAUDE.md §1):
 *
 *   www.ozirealty.com.au  the public website (canonical, where the search equity is)
 *   ozirealty.com.au      301 to www
 *   crm.ozirealty.com.au  the console: login and everything behind it
 *
 * One Next app answers all three, so this decides, per request, whether the path
 * belongs on the host it arrived at and where to send it if not. Pure, so it can be
 * tested without the Edge runtime. Unknown hosts (localhost, 127.0.0.1, the server's
 * own address) are left alone, which keeps local development and the assistant's
 * internal page fetches working.
 */

export type HostRedirect = { location: string; status: 301 | 307 };

/** Paths that only make sense on the console host. */
export function isConsolePath(pathname: string): boolean {
  return (
    isPrivatePath(pathname) ||
    pathname === "/login" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/website") ||
    pathname.startsWith("/api/media")
  );
}

/** Served on either host as-is: framework files, uploads, endpoints, static files. */
function isShared(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/media/") ||
    /\.[a-z0-9]{2,5}$/i.test(pathname)
  );
}

export function routeForHost(input: {
  host: string | undefined;
  pathname: string;
  search: string;
  publicHost: string;
  crmHost: string;
  /** Draft mode is on: a console user previewing website edits on the console host. */
  preview: boolean;
}): HostRedirect | null {
  const { host, pathname, search, publicHost, crmHost, preview } = input;
  if (!host) return null;
  const apex = publicHost.replace(/^www\./, "");

  if (host === apex && apex !== publicHost) {
    return { location: `https://${publicHost}${pathname}${search}`, status: 301 };
  }

  if (host === publicHost) {
    // The Wix site's property pages lived at /properties/<slug>; the console owns that
    // prefix on its own host, and the public equivalent is the for-sale page.
    if (pathname === "/properties" || pathname.startsWith("/properties/")) {
      return { location: `https://${publicHost}/for-sale`, status: 301 };
    }
    if (isConsolePath(pathname)) {
      return { location: `https://${crmHost}${pathname}${search}`, status: 307 };
    }
    return null;
  }

  if (host === crmHost) {
    if (pathname === "/") return { location: `https://${crmHost}/dashboard`, status: 307 };
    if (isConsolePath(pathname) || isShared(pathname) || preview) return null;
    // A public page asked for on the console host. Temporary (307), never cached: the
    // same URL must still reach the server when a preview cookie is present.
    return { location: `https://${publicHost}${pathname}${search}`, status: 307 };
  }

  return null;
}

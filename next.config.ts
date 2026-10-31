import type { NextConfig } from "next";

/**
 * Server-rendered from a Node process.
 *
 * The prototype exported to static files, which was right when it had no data: a dollar
 * a month and no server to patch. A backend cannot live there - a static export has no
 * process, so no Server Action, no database connection, no webhook. §2 rules out the
 * alternative ("Server Actions and Route Handlers are the API. Do not build a parallel
 * API surface"), so the site moves to Node on EC2 as §11 always described.
 */
const nextConfig: NextConfig = {
  /**
   * `output: "standalone"` would bundle a minimal server and keep the EC2 box from
   * needing the whole node_modules tree. It is enabled by an env flag rather than
   * unconditionally, because it builds via symlinks and Windows refuses those without
   * developer mode - so a local build would fail for a reason that has nothing to do
   * with the code. B6 sets STANDALONE=1 on the Linux build host.
   */
  ...(process.env.STANDALONE === "1" ? { output: "standalone" as const } : {}),
  /**
   * The public site is photography-led, so the optimizer is on and the hosts it may
   * fetch from are named. `unoptimized: true` was right while nothing rendered an
   * image; leaving it on for a listings site means shipping full-size originals with
   * no srcset, which is the easiest Core Web Vitals failure to ship.
   *
   * Two hosts, both temporary:
   *   - static.wixstatic.com serves the agency's logo until the vector lands in
   *     assets/brand (the README there has been asking for it since B0).
   *   - images.unsplash.com carries section furniture until real photography exists.
   *     Listing cards deliberately do NOT use it — a stock photo standing in for a
   *     specific house is a misrepresentation, so those show a placeholder until the
   *     media pipeline in Stage 4 can hold the real ones.
   */
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "static.wixstatic.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  /**
   * Kept out of the webpack bundle and loaded from node_modules at runtime: postgres
   * for the same reason as ever, bullmq/ioredis because bullmq probes for optional
   * drivers (valkey-glide) with dynamic requires that webpack can only warn about.
   */
  /**
   * Legacy URLs from the Wix site that are misspelt at the source.
   *
   * `docs/legacy-site.md` rule 6: fix the typo on the new site, 301 from the old
   * spelling, never drop the indexed URL. Both of these are in the live sitemap today, so
   * dropping them would throw away whatever ranking they carry.
   *
   * `statusCode: 301`, not `permanent: true`. Next's `permanent` emits a **308**, which
   * preserves the request method and is a different thing from the 301 the redirect plan
   * specifies. Google treats the two alike, but plenty of older crawlers, proxies and
   * link checkers do not, and a marketing URL only ever gets a GET.
   */
  async redirects() {
    return [
      { source: "/oversees-investment", destination: "/overseas-investment", statusCode: 301 },
      {
        source: "/contact-adelaide-realestae-agency",
        destination: "/contact",
        statusCode: 301,
      },
      // Wix URLs found in the live sitemap on 2026-10-26 with no page of their own here.
      { source: "/blog/categories/:slug*", destination: "/blog", statusCode: 301 },
      { source: "/inquiry-services-page", destination: "/contact", statusCode: 301 },
      { source: "/service-page/:slug*", destination: "/book-online", statusCode: 301 },
      { source: "/booking-calendar/:slug*", destination: "/book-online", statusCode: 301 },
      // The Gift Party page was retired on 2026-10-31 (owner's request). Its form lives on as
      // the home page's free-book section, which is where old links and search results go.
      { source: "/realestate-gift-adelaide", destination: "/#free-book", statusCode: 301 },
      // Renamed for search on 2026-10-31: "new homes" and "Adelaide" are what people type.
      { source: "/projects-and-opportunities", destination: "/new-homes-adelaide", statusCode: 301 },
    ];
  },
  serverExternalPackages: ["postgres", "bullmq", "ioredis"],
  /**
   * The property import posts the uploaded file to a Server Action. The 1 MB default
   * would refuse a small PDF; 5 MB of PDF is ~6.7 MB base64-encoded. Every action's own
   * Zod schema still caps its fields, so this raises the ceiling, not the allowance.
   */
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default nextConfig;

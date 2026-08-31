import type { MetadataRoute } from "next";
import { PRIVATE_PREFIXES } from "@/lib/private-paths";

/**
 * Replaces `public/robots.txt`, which said `Disallow: /` for the whole domain.
 *
 * That was correct while the deployment was a prototype console and would have been a
 * quiet disaster on cutover day: the new site would have gone live telling every crawler
 * to ignore it, and the 51 blog posts and four property pages carrying the agency's
 * existing search equity would have dropped out of the index. A static file also wins
 * over a generated route, so it is deleted rather than left alongside this.
 *
 * The disallow list is generated from the same constant the middleware gates on, so a
 * console route cannot end up crawlable just because someone forgot this file.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        ...PRIVATE_PREFIXES.map((p) => `${p}/`),
        "/login",
        "/api/",
      ],
    },
    sitemap: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.ozirealty.com.au"}/sitemap.xml`,
  };
}

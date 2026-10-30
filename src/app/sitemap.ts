import type { MetadataRoute } from "next";
import { suburbsWithListings } from "@/server/public/listings";
import { POSTS } from "@/components/public/posts";
import { publishedCustomPaths } from "@/server/public/content";

/**
 * sitemap.xml for the public site: every static page, every blog post (kept at the
 * live site's /post/<slug>), and one entry per suburb page.
 * Listing detail pages join it when they exist.
 */

export const revalidate = 3600;

const PAGES = [
  "",
  "/listings",
  "/for-sale",
  "/sold",
  "/suburbs",
  "/property-services",
  "/property-strategy-services",
  "/overseas-investment",
  "/free-property-appraisal-sa",
  "/free-suburb-insight-report",
  "/property-rental-report",
  "/manage-property-adelaide",
  "/sell-property-house-adelaide",
  "/rent-out-my-property-adelaide",
  "/rent-property-house-adelaide",
  "/buyer-agent-adelaide",
  "/property-investment",
  "/land-opportunities-sa-adelaide",
  "/sell-my-business-australia",
  "/about-adelaide-land-agent",
  "/contact",
  "/book-online",
  "/realestate-gift-adelaide",
  "/blog",
  "/adelaide-property-faq",
  "/privacy",
  "/terms",
  "/complaints",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.ozirealty.com.au";
  let suburbs: { slug: string }[] = [];
  try {
    suburbs = await suburbsWithListings();
  } catch {
    // A database hiccup should cost the suburb entries, not the whole sitemap.
  }
  const custom = await publishedCustomPaths();
  return [
    ...PAGES.map((p) => ({ url: base + p })),
    ...custom.map((p) => ({ url: base + p })),
    ...POSTS.map((p) => ({ url: `${base}/post/${p.slug}` })),
    ...suburbs.map((s) => ({ url: `${base}/suburbs/${s.slug}` })),
  ];
}

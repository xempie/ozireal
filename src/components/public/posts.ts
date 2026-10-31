import raw from "@/content/posts.json";

/**
 * The blog, migrated out of Wix by `scripts/scrape-blog.mjs`.
 *
 * A JSON file in the repo rather than rows in the database, deliberately. The posts are
 * static content: reading them from a build-time import means the blog renders with no
 * query and no network, survives the Wix account lapsing, and shows up in a diff when it
 * changes. When the CMS side of Phase 5 exists this becomes a table and this module
 * becomes the query; nothing that imports it needs to change.
 *
 * `slug` is the Wix slug. Posts are served at `/blog/<seoSlug>` since 2026-10-31 and the
 * old `/post/<slug>` addresses permanently redirect (see SEO_SLUGS below).
 *
 * Re-run the scraper before cutover. The live blog is actively published to, so this
 * snapshot goes stale, and a post written during the migration that nobody re-pulled is
 * the classic way content is lost.
 */

export interface PostBlock {
  t: "p" | "h2" | "h3" | "ul";
  text?: string;
  items?: string[];
}

export interface Post {
  slug: string;
  title: string;
  description: string;
  /** ISO date, or "" when the source had none. */
  date: string;
  author: string;
  /** Local path under /public/blog, or null when the cover could not be fetched. */
  cover: string | null;
  coverAlt: string;
  blocks: PostBlock[];
}

/**
 * The headline in Wix's JSON-LD is the SEO title, so it carries a brand suffix:
 * "Investment Property Advice in Adelaide | Ozi Realty". That belongs in <title>, not in
 * an h1 on the agency's own site, where it reads as a mistake. Stripped at read time
 * rather than in the data, so a re-scrape does not have to remember to do it.
 */
function displayTitle(t: string): string {
  return t.replace(/\s*[|–—-]\s*Ozi\s?Realty\s*$/i, "").trim() || t;
}

/** Newest first, and only posts that actually have a body worth rendering. */
export const POSTS: Post[] = (raw as Post[])
  .filter((p) => p.title && p.blocks.length > 0)
  .map((p) => ({ ...p, title: displayTitle(p.title), coverAlt: displayTitle(p.coverAlt || p.title) }))
  .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

export const postBySlug = (slug: string) => POSTS.find((p) => p.slug === slug);

/** Reading time, from the same 200 words-per-minute everyone uses. */
export function readingMinutes(p: Post): number {
  const words = p.blocks.reduce(
    (n, b) => n + (b.text ?? "").split(/\s+/).length + (b.items ?? []).join(" ").split(/\s+/).length,
    0,
  );
  return Math.max(1, Math.round(words / 200));
}

export function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/**
 * Twelve to a page.
 *
 * Fifty-four cards on one page was one request and no pagination to get wrong, which is
 * the right trade at fifty. It stops being the right trade as the blog grows: the page
 * carries every cover image, so the weight climbs with the archive and the reader pays
 * for fifty posts to reach the three they wanted.
 *
 * Twelve fills four rows of three on a desktop and is a short scroll on a phone.
 */
export const POSTS_PER_PAGE = 12;

export const pageCount = () => Math.max(1, Math.ceil(POSTS.length / POSTS_PER_PAGE));

export function postsForPage(n: number): Post[] {
  const start = (n - 1) * POSTS_PER_PAGE;
  return POSTS.slice(start, start + POSTS_PER_PAGE);
}

/**
 * Search-friendly addresses (owner's request, 2026-10-31).
 *
 * Posts moved from `/post/<wix-slug>` to `/blog/<slug>`, and the long Wix slugs were cut
 * down to the phrase people actually search. Every old address permanently redirects
 * (app/(public)/post/[slug]), so the indexed equity carries over. A slug not listed here
 * keeps its Wix slug under /blog. Never reuse or change a new slug once live.
 */
const SEO_SLUGS: Record<string, string> = {
  "rental-property-maintenance-in-adelaide-what-landlords-need-to-know": "rental-property-maintenance-adelaide",
  "what-to-expect-from-a-rental-property-inspection-in-adelaide": "rental-property-inspection-adelaide",
  "optimise-your-property-management-in-adelaide-adelaide-property-management-services": "optimise-property-management-adelaide",
  "where-can-i-buy-a-house-in-the-centre-of-adelaide": "buy-a-house-central-adelaide",
  "best-property-management-services-in-prospect-au": "property-management-prospect",
  "understanding-property-valuation-methods-adelaide-a-friendly-guide": "property-valuation-methods-adelaide",
  "effective-investment-property-management-tips-in-adelaide": "investment-property-management-tips-adelaide",
  "australian-property-investment-guide-international-property-investment-opportunities-in-australia": "international-property-investment-australia",
  "the-essentials-of-effective-property-management": "effective-property-management-essentials",
  "mastering-property-management-in-adelaide-essential-property-management-tips": "property-management-tips-adelaide",
  "why-use-ozi-realty-buyer-agent-services-for-market-and-property-analysis": "market-and-property-analysis",
  "why-use-buyer-agent-services-when-buying-property-in-adelaide": "why-use-a-buyers-agent-adelaide",
  "discover-how-a-free-suburb-insight-report-can-help-you-make-smarter-property-decisions": "free-suburb-insight-report",
  "how-rising-bank-interest-rates-impact-property-management-in-south-australia": "interest-rates-property-management-sa",
  "property-rental-estimation-know-what-your-property-can-earn-today": "rental-estimate-what-your-property-can-earn",
  "discover-the-power-of-a-free-property-appraisal-with-ozi-realty": "free-property-appraisal-adelaide",
  "adelaide-property-rental-report-smart-rent-stable-income-zero-guesswork": "adelaide-property-rental-report",
  "unlock-the-benefits-of-a-local-real-estate-agency-with-ozi-realty-adelaide": "local-real-estate-agency-adelaide",
  "top-strategies-for-accurate-property-value-appraisal": "accurate-property-appraisal-strategies",
  "unlocking-the-power-of-a-free-suburb-insight-report-in-adelaide": "suburb-insight-report-adelaide",
  "why-routine-inspections-are-crucial-for-property-care": "routine-property-inspections",
  "how-ozi-realty-adelaide-streamlines-property-management-services": "streamlined-property-management-adelaide",
  "enhance-your-property-management-strategies-in-adelaide-for-effective-property-management-1": "property-management-strategies-adelaide-2",
  "enhance-your-property-management-strategies-in-adelaide-for-effective-property-management": "property-management-strategies-adelaide",
  "discover-expert-property-management-services-by-ozi-realty-adelaide": "expert-property-management-adelaide",
  "100-day-risk-free-property-management-in-adelaide-your-ultimate-guide": "risk-free-property-management-adelaide",
  "how-a-property-manager-can-help-you-save-more-money-in-south-australia": "property-manager-save-money-sa",
  "why-ozi-realty-adelaide-stands-out-in-property-appraisal-services": "property-appraisal-services-adelaide",
  "understanding-the-range-of-real-estate-offerings": "real-estate-opportunities",
  "get-expert-property-management-advice-from-ozi-realty-adelaide": "property-management-guidance-adelaide",
  "explore-ozi-realty-adelaide-s-property-expertise-your-guide-to-adelaide-property-management-service": "adelaide-property-management-services",
  "top-strategies-for-effective-property-management-strategies": "property-management-strategies",
  "independent-property-valuation-in-adelaide-your-guide-to-smart-property-decisions": "independent-property-valuation-adelaide",
  "understanding-the-property-appraisal-process": "property-appraisal-process",
  "choosing-the-best-real-estate-agent-adelaide-has-to-offer": "choosing-a-real-estate-agent-adelaide",
  "discover-your-dream-houses-for-sale-adelaide": "houses-for-sale-adelaide",
  "explore-essential-real-estate-solutions-in-australia": "real-estate-solutions-australia",
  "comprehensive-real-estate-services-for-australians": "real-estate-services-australia",
  "the-essentials-of-property-management-in-australia": "how-property-management-works-australia",
  "how-to-successfully-sell-your-investment-property": "sell-an-investment-property",
  "how-buyer-agents-simplify-the-home-buying-process": "buyer-agents-home-buying",
  "how-to-maximise-returns-from-investment-properties": "maximise-investment-property-returns",
  "what-will-homes-look-like-in-2050-imagine-it-in-adelaide": "adelaide-homes-in-2050",
  "navigating-the-adelaide-rental-market-smart-tips-for-tenants-landlords-in-2025": "adelaide-rental-market-tips",
  "adelaide-s-most-luxurious-homes-where-to-find-the-best-high-end-properties": "luxury-homes-adelaide",
  "why-2025-is-the-perfect-time-to-buy-a-house-in-adelaide": "buying-a-house-in-adelaide",
};

/** The post's address under /blog. */
export const seoSlug = (p: Post) => SEO_SLUGS[p.slug] ?? p.slug;
export const postHref = (p: Post) => `/blog/${seoSlug(p)}`;
export const postBySeoSlug = (s: string) => POSTS.find((p) => seoSlug(p) === s);

/** Topics, in display order. Each gets an indexable page at /blog/topic/<key>. */
export const TOPICS = [
  { key: "property-management", label: "Property management", re: /property[- ]manage|property[- ]manager|managing/ },
  { key: "landlords", label: "Landlords", re: /landlord|tenant|arrears|rent[- ]review|rental[- ]property|inspection|prepare[- ]rental/ },
  { key: "selling", label: "Selling", re: /\bsell|selling/ },
  { key: "appraisal-valuation", label: "Appraisal & valuation", re: /apprais|valuation|value/ },
  { key: "buying", label: "Buying", re: /\bbuy|buyer|for[- ]sale|luxur|dream/ },
  { key: "investment", label: "Investment", re: /invest/ },
  { key: "rent-yield", label: "Rent & yield", re: /rent[- ]review|rental[- ](report|estimat|market)|yield|earn|rental potential/ },
  { key: "suburbs-market", label: "Suburbs & market", re: /suburb|prospect|centre|central|2050|market|interest rate/ },
  { key: "agents", label: "Choosing an agent", re: /agent|agency|real[- ]estate[- ](services|solutions|offerings|opportunit)|expertise/ },
] as const;

export type TopicKey = (typeof TOPICS)[number]["key"];

/** Up to three topics per post, from its slug and title; never empty. */
export function topicsOf(p: Post): TopicKey[] {
  const hay = `${p.slug} ${p.title}`.toLowerCase();
  const hit = TOPICS.filter((t) => t.re.test(hay)).map((t) => t.key);
  return (hit.length ? hit : (["agents"] as TopicKey[])).slice(0, 3);
}

export const topicLabel = (k: string) => TOPICS.find((t) => t.key === k)?.label ?? k;

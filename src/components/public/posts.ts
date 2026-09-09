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
 * `docs/legacy-site.md` is emphatic that `/post/<slug>` is kept verbatim, because
 * preserving those indexed URLs is worth far more than a tidier path. The slug here is
 * the slug there.
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

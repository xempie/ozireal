/**
 * One-shot migration of the Wix blog into this repo.
 *
 * `docs/legacy-site.md` (2B.9a) says the blog is 51+ posts at `/post/<slug>`, that the
 * URL pattern is kept verbatim because preserving those indexed URLs is worth more than
 * a tidier path, and that the content has to come out of Wix because nothing there is
 * portable as code.
 *
 * ## Plain fetch, not a browser
 *
 * The first version of this drove Playwright, on the assumption that a Wix page needs
 * JavaScript before its body exists. It does not: the post body is server-rendered inside
 * `<div data-id="content-viewer">`, and the headline, description, date and cover are all
 * in a `BlogPosting` JSON-LD block. Fifty-four fetches take under a minute where fifty-four
 * browser page loads took twenty and had not finished.
 *
 * ## It is deliberately a script, not a runtime fetch
 *
 * The posts become static content in the repo. A build-time file means the blog renders
 * with no database and no network, survives the Wix account lapsing, and is diffable in
 * review. Re-run it before cutover: the blog is actively published to, so this snapshot
 * goes stale, and a post written during the migration that nobody re-pulled is the classic
 * way content is lost.
 *
 *   node scripts/scrape-blog.mjs
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const SITE = "https://www.ozirealty.com.au";
const UA = { "user-agent": "Mozilla/5.0 (compatible; OziRealty-migration/1.0)" };
const IMG_DIR = join(process.cwd(), "public", "blog");
const OUT_DIR = join(process.cwd(), "src", "content");
mkdirSync(IMG_DIR, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });

/** Decode the entities Wix emits, then collapse whitespace. */
function text(html) {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;|&#38;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2019;|&rsquo;/g, "’")
    .replace(/&#x2018;|&lsquo;/g, "‘")
    .replace(/&#x201C;|&ldquo;/g, "“")
    .replace(/&#x201D;|&rdquo;/g, "”")
    .replace(/&#x2013;|&ndash;/g, "–")
    .replace(/&#x2014;|&mdash;/g, "—")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

/** The richest BlogPosting block; Wix emits more than one and they differ. */
function jsonLd(html) {
  let best = {};
  for (const m of html.matchAll(
    /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
  )) {
    try {
      const j = JSON.parse(m[1]);
      if (j["@type"] === "BlogPosting" && Object.keys(j).length > Object.keys(best).length) {
        best = j;
      }
    } catch {}
  }
  return best;
}

/**
 * The article body, as blocks rather than one blob, so headings and lists survive into
 * something renderable. Scoped to the content-viewer node: outside it the same tags are
 * navigation, related posts and the comment form.
 */
/**
 * Boilerplate that is not part of any post.
 *
 * The content-viewer node is followed by the site's own footer, and the first pass swept
 * it into every post: "Recent Posts", the five department emails, the address, the licence
 * number, the whole Quick Links nav and the copyright line. Cutting at the first of these
 * is reliable because all of it sits AFTER the article, in the same order, on every post.
 */
const CUT_AT = [
  /^Recent Posts$/i,
  /^Email\s*\/\s*Call$/i,
  /^Quick Links$/i,
  /^Tel:\s/i,
  /^Emails:/i,
  /^Address:\s/i,
  /^Licence Number:/i,
  /^ABN:/i,
  /All rights reserved/i,
  /^Comments?$/i,
  /^Share this post/i,
  /^Recommended Posts$/i,
];

/** Individual lines that are footer furniture wherever they appear. */
const DROP = [
  /^[a-z]+@ozirealty\.com\.au$/i,
  /^(Home|Services|Strategy Services|Oversea Investment|Free Appraisal|About|Contact Us|Free Meeting|Gift Party|Blog|FAQ)$/,
  /^\d+ min read$/i,
  /^\d+ views?$/i,
  /^Write a comment/i,
  /^Log in \/ Sign up/i,
  /^Ozi ?Realty$/i,
  /* Trailing sign-offs the author added inside the article, which duplicate the site
     footer once the post is rendered inside this layout. */
  /^Ozi ?Realty\s*[—|-]\s*(308\s*Prospect|RLA)/i,
  /^RLA\s?350\s?628\.?$/i,
];

/**
 * The article body, as blocks rather than one blob, so headings and lists survive into
 * something renderable. Scoped to the content-viewer node, then truncated at the first
 * footer marker, because Wix does not close that node before the footer starts.
 */
function blocks(html) {
  const start = html.indexOf('data-id="content-viewer"');
  if (start === -1) return [];
  const body = html.slice(start);

  const out = [];
  for (const m of body.matchAll(/<(p|h2|h3|h4|ul|ol)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
    const tag = m[1];

    if (tag === "ul" || tag === "ol") {
      const items = [...m[2].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)]
        .map((li) => text(li[1]))
        .filter((t) => t && !DROP.some((re) => re.test(t)));
      if (items.length) out.push({ t: "ul", items });
      continue;
    }

    const t = text(m[2]);
    if (!t) continue;
    if (CUT_AT.some((re) => re.test(t))) break;
    if (DROP.some((re) => re.test(t))) continue;

    if (tag === "h2" || tag === "h3" || tag === "h4") {
      out.push({ t: tag === "h4" ? "h3" : tag, text: t });
    } else if (t.length > 1) {
      out.push({ t: "p", text: t });
    }
  }

  /*
    A trailing heading with nothing under it is the start of a section that was cut, so
    it reads as a dangling title. Drop them.
  */
  while (out.length && out[out.length - 1].t !== "p" && out[out.length - 1].t !== "ul") {
    out.pop();
  }
  return out;
}

function coverUrl(ld) {
  let src = ld.image;
  if (Array.isArray(src)) src = src[0];
  if (src && typeof src === "object") src = src.url || src.contentUrl;
  return typeof src === "string" ? src : null;
}

const sitemap = await (await fetch(`${SITE}/blog-posts-sitemap.xml`, { headers: UA })).text();
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
console.log(`${urls.length} posts in the sitemap\n`);

const posts = [];
let n = 0;

for (const url of urls) {
  const slug = url.split("/post/")[1];
  n++;
  try {
    const html = await (await fetch(url, { headers: UA })).text();
    const ld = jsonLd(html);
    const body = blocks(html);

    let cover = null;
    const src = coverUrl(ld);
    if (src) {
      // Ask Wix for a size worth rendering rather than whatever the tag happened to use.
      const big = src.replace(/\/v1\/[^/]*\/fill\/w_\d+,h_\d+/, "/v1/fill/w_1200,h_686");
      const ext = /\.png/i.test(src) ? "png" : "jpg";
      const file = `${slug}.${ext}`;
      const dest = join(IMG_DIR, file);
      if (!existsSync(dest)) {
        const r = await fetch(big, { headers: UA });
        if (r.ok) writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
      }
      if (existsSync(dest)) cover = `/blog/${file}`;
    }

    posts.push({
      slug,
      title: text(ld.headline || "") || slug.replace(/-/g, " "),
      description: text(ld.description || ""),
      date: (ld.datePublished || ld.dateModified || "").slice(0, 10),
      author: typeof ld.author === "object" ? ld.author?.name || "Esi Dor" : ld.author || "Esi Dor",
      cover,
      coverAlt: text(ld.headline || slug),
      blocks: body,
    });
    console.log(
      `  ${String(n).padStart(2)}/${urls.length}  ${slug}  ${body.length} blocks${cover ? ", cover" : ", NO COVER"}`,
    );
  } catch (e) {
    console.log(`  ${String(n).padStart(2)}/${urls.length}  ${slug}  FAILED ${e.message.slice(0, 60)}`);
  }
}

posts.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
writeFileSync(join(OUT_DIR, "posts.json"), JSON.stringify(posts, null, 1), "utf8");

const noBody = posts.filter((p) => p.blocks.length === 0).length;
const noCover = posts.filter((p) => !p.cover).length;
console.log(`\n${posts.length} posts written to src/content/posts.json`);
console.log(`${noBody} with no body, ${noCover} with no cover`);

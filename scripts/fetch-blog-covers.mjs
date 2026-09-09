/**
 * Fill in any blog cover the main scrape missed.
 *
 * `scrape-blog.mjs` looks for the cover inside the article container it detects, and on
 * some Wix layouts the hero image sits outside that container, so the post comes back
 * with `cover: null`. Every post also carries a `BlogPosting` JSON-LD block with an
 * `image`, which is the more reliable source and needs no browser at all.
 *
 * So this is a cheap second pass: plain fetch, read the JSON-LD, download what is
 * missing. Idempotent, and it only touches posts whose cover is still null, so running
 * it after a re-scrape costs nothing for the ones already done.
 *
 *   node scripts/fetch-blog-covers.mjs
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const SITE = "https://www.ozirealty.com.au";
const OUT = join(process.cwd(), "src", "content", "posts.json");
const IMG_DIR = join(process.cwd(), "public", "blog");
mkdirSync(IMG_DIR, { recursive: true });

const posts = JSON.parse(readFileSync(OUT, "utf8"));
const missing = posts.filter((p) => !p.cover);
console.log(`${posts.length} posts, ${missing.length} without a cover`);

let fixed = 0;
for (const post of missing) {
  try {
    const html = await (
      await fetch(`${SITE}/post/${post.slug}`, { headers: { "user-agent": "Mozilla/5.0" } })
    ).text();

    /** The richest BlogPosting block wins; Wix emits more than one. */
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

    let src = best.image;
    if (Array.isArray(src)) src = src[0];
    if (src && typeof src === "object") src = src.url || src.contentUrl;
    if (!src) {
      console.log(`  -- ${post.slug}: no image in JSON-LD`);
      continue;
    }

    // Ask Wix for a size worth rendering rather than whatever the tag happened to use.
    const big = String(src).replace(/\/v1\/[^/]*\/fill\/w_\d+,h_\d+/, "/v1/fill/w_1200,h_686");
    const ext = /\.png/i.test(String(src)) ? "png" : "jpg";
    const file = `${post.slug}.${ext}`;
    const dest = join(IMG_DIR, file);

    if (!existsSync(dest)) {
      const r = await fetch(big, { headers: { "user-agent": "Mozilla/5.0" } });
      if (!r.ok) {
        console.log(`  -- ${post.slug}: HTTP ${r.status}`);
        continue;
      }
      writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
    }
    post.cover = `/blog/${file}`;
    post.coverAlt = post.coverAlt || post.title;
    fixed++;
    console.log(`  +  ${post.slug}`);
  } catch (e) {
    console.log(`  !! ${post.slug}: ${e.message.slice(0, 60)}`);
  }
}

writeFileSync(OUT, JSON.stringify(posts, null, 1), "utf8");
console.log(`\n${fixed} cover(s) added. ${posts.filter((p) => !p.cover).length} still without one.`);

/**
 * Re-encode the migrated blog covers.
 *
 * Wix serves them as full-size PNGs, which came to 65MB across 53 posts. That is 65MB in
 * every deploy tarball, copied onto an instance with 1.8GB of RAM that has already been
 * taken down once by memory pressure. They are photographs, so PNG is the wrong container
 * for them anyway: JPEG at quality 80 gives the same picture at roughly a tenth the size.
 *
 * next/image resizes and re-encodes at request time regardless, so this only changes what
 * the repo carries and what the deploy ships. 1400px wide is more than the largest slot
 * the design gives a cover (a 1000px content column at 2x is 2000, but no cover is ever
 * displayed at more than 1200 CSS pixels, and the optimiser downscales from here anyway).
 *
 * Rewrites the paths in posts.json to match, and deletes the PNG it replaced. Idempotent:
 * a post already pointing at a .jpg is skipped.
 *
 *   node scripts/optimise-blog-images.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

/**
 * sharp ships as a transitive dependency of next rather than a direct one, so it is not
 * resolvable from the project root. Reaching it through next's own resolution is honest
 * about that, and avoids adding a dependency for a script that runs once per migration.
 */
const require = createRequire(import.meta.url);
let sharp;
try {
  sharp = require(require.resolve("sharp", { paths: [require.resolve("next/package.json")] }));
} catch (e) {
  console.error("sharp is not resolvable through next:", e.message);
  process.exit(1);
}

const IMG_DIR = join(process.cwd(), "public", "blog");
const POSTS = join(process.cwd(), "src", "content", "posts.json");

const before = readdirSync(IMG_DIR).reduce((n, f) => n + statSync(join(IMG_DIR, f)).size, 0);
const posts = JSON.parse(readFileSync(POSTS, "utf8"));
let converted = 0;

for (const post of posts) {
  if (!post.cover || post.cover.endsWith(".jpg")) continue;
  const src = join(process.cwd(), "public", post.cover.replace(/^\//, ""));
  if (!existsSync(src)) continue;

  const outName = `${post.slug}.jpg`;
  const dest = join(IMG_DIR, outName);
  await sharp(src)
    .resize({ width: 1400, withoutEnlargement: true })
    // A white floor under any transparency, so a PNG with an alpha channel does not
    // become a black rectangle when it loses one.
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 80, mozjpeg: true })
    .toFile(dest);

  unlinkSync(src);
  post.cover = `/blog/${outName}`;
  converted++;
}

writeFileSync(POSTS, JSON.stringify(posts, null, 1), "utf8");

const after = readdirSync(IMG_DIR).reduce((n, f) => n + statSync(join(IMG_DIR, f)).size, 0);
const mb = (b) => (b / 1024 / 1024).toFixed(1);
console.log(`${converted} covers re-encoded`);
console.log(`public/blog: ${mb(before)}MB -> ${mb(after)}MB`);

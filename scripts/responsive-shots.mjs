/**
 * Screenshot every route at several viewports, into docs/screenshots/responsive/.
 * Also reports horizontal-overflow offenders, which is the defect that actually
 * breaks a phone layout and is invisible in a desktop screenshot.
 *
 *   node scripts/responsive-shots.mjs <port> [theme]
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const port = process.argv[2] ?? "3210";
const theme = process.argv[3] ?? "light";
const base = `http://localhost:${port}`;
const outDir = join(process.cwd(), "docs", "screenshots", "responsive");
mkdirSync(outDir, { recursive: true });

const viewports = [
  ["mobile", 390, 844],   // iPhone 14
  ["tablet", 820, 1180],  // iPad Air portrait
  ["desktop", 1440, 900],
];

const routes = [
  ["login", "/"],
  ["dashboard", "/dashboard/"],
  ["reports", "/reports/"],
  ["contacts", "/contacts/"],
  ["contact-detail", "/contacts/c1/"],
  ["properties", "/properties/"],
  ["property-detail", "/properties/p3/"],
  ["listings", "/listings/"],
  ["listing-detail", "/listings/l3/"],
  ["matching", "/matching/"],
  ["campaigns", "/campaigns/"],
  ["approvals", "/approvals/"],
  ["confirm", "/confirm/"],
  ["tasks", "/tasks/"],
  ["calendar", "/calendar/"],
  ["voice", "/voice/"],
  ["compliance", "/compliance/"],
  ["proposals", "/proposals/"],
  ["content", "/content/"],
  ["seo", "/seo/"],
  ["website", "/website/"],
  ["costs", "/costs/"],
  ["audit", "/audit/"],
  ["settings", "/settings/"],
];

const browser = await chromium.launch();
const problems = [];

for (const [vpName, width, height] of viewports) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    isMobile: vpName === "mobile",
    hasTouch: vpName !== "desktop",
  });
  await ctx.addInitScript((t) => {
    try { localStorage.setItem("ozi-theme", t); } catch {}
  }, theme);
  const page = await ctx.newPage();

  for (const [name, path] of routes) {
    await page.goto(base + path, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);

    // Does the page scroll sideways? That is the defect that ruins a phone.
    const overflow = await page.evaluate(() => {
      const de = document.documentElement;
      const over = de.scrollWidth - de.clientWidth;
      if (over <= 1) return { over: 0, culprits: [] };
      const culprits = [];
      for (const el of document.querySelectorAll("*")) {
        const r = el.getBoundingClientRect();
        if (r.right > de.clientWidth + 1 && r.width > 40) {
          culprits.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.className || "").toString().slice(0, 70),
            right: Math.round(r.right),
            w: Math.round(r.width),
          });
        }
      }
      // Keep only the outermost offenders; children inherit the parent's problem.
      return { over, culprits: culprits.slice(0, 4) };
    });

    // Anything tappable smaller than ~32px is hard to hit on a phone.
    const smallTargets = vpName === "mobile"
      ? await page.evaluate(() => {
          let n = 0;
          for (const el of document.querySelectorAll("a,button,input,[role=button]")) {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.height > 0 && (r.height < 30 || r.width < 30)) n++;
          }
          return n;
        })
      : 0;

    if (overflow.over > 1 || smallTargets > 0) {
      problems.push({ vp: vpName, name, over: overflow.over, culprits: overflow.culprits, smallTargets });
    }

    await page.screenshot({
      path: join(outDir, `${vpName}-${name}.png`),
      fullPage: true,
    });
  }
  await ctx.close();
  console.log(`captured ${vpName} (${width}x${height})`);
}
await browser.close();

console.log("\n=== HORIZONTAL OVERFLOW / TAP TARGETS ===");
if (!problems.length) console.log("none");
for (const p of problems) {
  console.log(`\n${p.vp.padEnd(8)} ${p.name.padEnd(16)} overflow=${p.over}px  smallTargets=${p.smallTargets}`);
  for (const c of p.culprits) console.log(`    <${c.tag}> w=${c.w} right=${c.right}  ${c.cls}`);
}

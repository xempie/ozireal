/**
 * Screenshots every console route, light and dark, into docs/screenshots/.
 *
 * Charts are client-rendered (Recharts measures the DOM), so a curl check cannot
 * confirm they draw. This can. Run with the production server already listening:
 *
 *   pnpm build && pnpm start -p 3130
 *   node scripts/screenshots.mjs 3130
 */

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const port = process.argv[2] ?? "3000";
const base = `http://localhost:${port}`;
const outDir = join(process.cwd(), "docs", "screenshots");
mkdirSync(outDir, { recursive: true });

const routes = [
  ["login", "/login"],
  ["dashboard", "/dashboard"],
  ["reports", "/reports"],
  ["contacts", "/contacts"],
  ["contact-detail", "/contacts/c1"],
  ["properties", "/properties"],
  ["property-detail", "/properties/p3"],
  ["listings", "/listings"],
  ["listing-detail", "/listings/l3"],
  ["matching", "/matching"],
  ["campaigns", "/campaigns"],
  ["approvals", "/approvals"],
  ["confirm", "/confirm"],
  ["tasks", "/tasks"],
  ["calendar", "/calendar"],
  ["voice", "/voice"],
  ["compliance", "/compliance"],
  ["proposals", "/proposals"],
  ["content", "/content"],
  ["seo", "/seo"],
  ["website", "/website"],
  ["costs", "/costs"],
  ["audit", "/audit"],
  ["settings", "/settings"],
];

const browser = await chromium.launch();
let failures = 0;
let chartTotal = 0;

for (const theme of ["light", "dark"]) {
  const ctx = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 1,
  });
  // Set the stored preference before any page script runs.
  await ctx.addInitScript((t) => {
    try {
      localStorage.setItem("ozi-theme", t);
    } catch {}
  }, theme);

  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  for (const [name, path] of routes) {
    errors.length = 0;
    await page.goto(base + path, { waitUntil: "networkidle" });
    // Recharts animates in; give it a beat to settle before capturing.
    await page.waitForTimeout(600);

    const charts = await page.locator(".recharts-surface").count();
    chartTotal += charts;

    await page.screenshot({
      path: join(outDir, `${theme}-${name}.png`),
      fullPage: true,
    });

    const status = errors.length ? `ERRORS: ${errors.slice(0, 2).join(" | ")}` : "ok";
    if (errors.length) failures++;
    console.log(
      `${theme.padEnd(5)} ${name.padEnd(18)} charts=${String(charts).padStart(2)}  ${status}`,
    );
  }
  await ctx.close();
}

await browser.close();
console.log(`\n${routes.length * 2} screenshots written to docs/screenshots`);
console.log(`chart surfaces rendered across all pages: ${chartTotal}`);
console.log(failures ? `PAGES WITH CONSOLE ERRORS: ${failures}` : "no console errors");
process.exit(failures ? 1 : 0);

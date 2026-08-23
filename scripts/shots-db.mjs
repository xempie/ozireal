import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
const out = join(process.cwd(), "docs", "screenshots", "db-backed");
mkdirSync(out, { recursive: true });
const routes = ["login","dashboard","reports","contacts","properties","listings",
  "matching","campaigns","approvals","confirm","tasks","calendar","voice",
  "compliance","proposals","content","seo","website","costs","audit","settings"];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => { try { localStorage.setItem("ozi-theme","light"); } catch {} });
const p = await ctx.newPage();
let errs = 0, charts = 0;
p.on("pageerror", e => { console.log("  PAGE ERROR", e.message.slice(0,90)); errs++; });
p.on("console", m => { if (m.type()==="error") { console.log("  CONSOLE", m.text().slice(0,90)); errs++; } });
for (const r of routes) {
  const res = await p.goto(`http://localhost:3200/${r}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(500);
  charts += await p.locator(".recharts-surface").count();
  const over = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await p.screenshot({ path: join(out, `${r}.png`), fullPage: true });
  console.log(`  ${String(res.status()).padEnd(4)} /${r.padEnd(12)} overflow=${over}`);
}
await b.close();
console.log(`\ncharts rendered: ${charts}, console errors: ${errs}`);
process.exit(errs ? 1 : 0);

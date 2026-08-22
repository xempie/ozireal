/** Verify the deployed site at mobile/tablet/desktop, behind basic auth. */
import { chromium } from "playwright";
const base = process.argv[2];
const creds = process.argv[3];  // optional "user:pass" - the site is public now
const routes = ["/", "/dashboard/", "/reports/", "/contacts/", "/properties/",
  "/listings/", "/matching/", "/campaigns/", "/approvals/", "/confirm/", "/tasks/",
  "/calendar/", "/voice/", "/compliance/", "/proposals/", "/content/", "/seo/",
  "/website/", "/costs/", "/audit/", "/settings/"];
const vps = [["mobile", 390, 844], ["tablet", 820, 1180], ["desktop", 1440, 900]];
const b = await chromium.launch();
let bad = 0;
for (const [name, width, height] of vps) {
  const ctx = await b.newContext({
    viewport: { width, height },
    ...(creds
      ? { httpCredentials: { username: creds.split(":")[0], password: creds.split(":")[1] } }
      : {}),
  });
  const p = await ctx.newPage();
  let over = 0, errs = 0;
  p.on("pageerror", () => errs++);
  for (const r of routes) {
    const res = await p.goto(base + r, { waitUntil: "networkidle" });
    await p.waitForTimeout(300);
    if (!res || res.status() !== 200) { console.log(`  ${name} ${r} HTTP ${res && res.status()}`); bad++; }
    const o = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (o > 1) { console.log(`  ${name} ${r} overflow ${o}px`); over++; bad++; }
  }
  console.log(`${name.padEnd(8)} ${routes.length} routes, overflow issues: ${over}, page errors: ${errs}`);
  await ctx.close();
}
await b.close();
console.log(bad ? `FAILURES: ${bad}` : "all clean on the live site");

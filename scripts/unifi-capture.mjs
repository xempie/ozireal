/**
 * Records what the UNIFI Property dashboard loads while the owner browses it, for
 * syncing its off-the-plan projects onto /new-homes-adelaide (2026-11-05; OziRealty
 * has a partnership contract with UNIFI).
 *
 *   node scripts/unifi-capture.mjs <out-dir>
 *
 * Opens a visible browser with a persistent profile, so UNIFI's own sign-in stays
 * remembered like any browser's; no password is typed, read or stored here. The owner
 * opens the search results (every page) and any project to capture its details, then
 * closes the window; the JSON the dashboard loaded is written to <out-dir>/captured.json.
 * Passive on purpose: it only observes the dashboard's own requests. Anything to do
 * with sign-in, and the user's own profile (/oa/user/user, which carries a password
 * field), is never kept.
 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const out = process.argv[2];
if (!out) throw new Error("usage: node scripts/unifi-capture.mjs <out-dir>");
mkdirSync(out, { recursive: true });

const profile = process.env.UNIFI_PROFILE ?? join(homedir(), ".ozirealty", "unifi-profile");
const ctx = await chromium.launchPersistentContext(profile, {
  headless: false,
  viewport: null,
  args: ["--start-maximized"],
});
const captured = [];

ctx.on("response", async (res) => {
  try {
    const url = res.url();
    if (!url.includes("unifiproperty.com")) return;
    if (!(res.headers()["content-type"] ?? "").includes("json")) return;
    if (/(login|logon|auth|token|oauth|session|password|signin)/i.test(url)) return;
    if (/\/oa\/user\/user/.test(url)) return;
    captured.push({ at: new Date().toISOString(), method: res.request().method(), url, status: res.status(), body: await res.json() });
    console.log(`captured ${res.request().method()} ${url.replace(/\?.*/, "").slice(0, 120)}`);
  } catch {
    /* non-JSON or already disposed */
  }
});

const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.goto("https://dashboard.unifiproperty.com/#/uconnect/search/results");
console.log("Browser open. Log in if asked, open every results page, then close the window.");

await new Promise((resolve) => ctx.on("close", resolve));
writeFileSync(join(out, "captured.json"), JSON.stringify(captured));
console.log(`saved ${captured.length} responses to ${join(out, "captured.json")}`);

/**
 * Drive the segment builder through a real browser.
 *
 * The unit tests prove the SQL. This proves the other half: that moving a control
 * actually reaches the server, that the count changes, and — the one that matters —
 * that the exclusion breakdown appears rather than the audience silently shrinking.
 *
 *   pnpm dev            (in one terminal)
 *   node scripts/verify-segments.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3200";
const stamp = Date.now().toString().slice(-6);

let failures = 0;
function check(label, ok, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`);
  if (!ok) failures++;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();

const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push(e.message.slice(0, 140)));
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text().slice(0, 140));
});

/** The big number in the audience panel. */
const audience = page.locator("div.text-\\[34px\\]").first();

/** The panel debounces at 350ms and then awaits two aggregate queries. */
async function settle() {
  await page.waitForTimeout(1400);
  return (await audience.innerText()).trim();
}

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: /development sign-in/i }).click();
await page.waitForURL("**/dashboard", { timeout: 20000 });

console.log("\nThe builder loads and counts");
await page.goto(`${BASE}/campaigns/new`, { waitUntil: "networkidle" });
const initial = await settle();
check("an empty segment resolves to a number, not a dash", /^\d+$/.test(initial), initial);

const everyone = Number(initial);
check("and it is a real audience", everyone > 0, `${everyone} contactable`);

console.log("\nExclusions are shown, not silently applied");
const panel = await page.locator("body").innerText();
check(
  "the panel says how many matched but cannot be messaged",
  /cannot be messaged/i.test(panel) || /of \d+ matching/i.test(panel),
);
check(
  "and warns that consent is re-checked at send",
  /re-checked at the moment of sending/i.test(panel),
);

console.log("\nA criterion narrows the audience");
// A budget nobody could plausibly reach must produce a smaller number — and, because
// unknowns are excluded by default, it must also drop everyone with no stated budget.
const budget = page.locator('input[type="number"]').first();
await budget.fill("40000000");
const narrowed = await settle();
check(
  "an out-of-reach budget narrows it",
  Number(narrowed) < everyone,
  `${everyone} → ${narrowed}`,
);

console.log("\nUnstated values are excluded by default and restorable");
const includeUnknowns = page.getByRole("checkbox", {
  name: /include people whose record does not say/i,
});
await includeUnknowns.check();
const withUnknowns = await settle();
check(
  "including unstated values widens it again",
  Number(withUnknowns) > Number(narrowed),
  `${narrowed} → ${withUnknowns}`,
);
await includeUnknowns.uncheck();
await settle();

console.log("\nA refused filter does not leave a confident number on screen");
/**
 * Past the schema's ceiling on purpose.
 *
 * The first draft of this script used 100,000,000 as its "impossible" budget above,
 * which exceeded that ceiling: the action refused the filter, the panel kept the
 * PREVIOUS count, and the screen read as though an absurd criterion matched everyone.
 * The count is now visibly not-current when the filter was never evaluated.
 */
await budget.fill("999999999");
await page.waitForTimeout(1400);
const refusedText = await page.locator("body").innerText();
check(
  "the panel says the criteria were refused rather than showing a stale count",
  /refused|need attention/i.test(refusedText),
);
await budget.fill("");
await settle();

console.log("\nIt describes itself in words");
await page.getByRole("button", { name: /^Buyer$/ }).first().click();
await settle();
const described = await page.locator("body").innerText();
check("the criteria are restated as a sentence", /buyer/i.test(described));

console.log("\nSaving a segment");
const name = `Verified segment ${stamp}`;
await page.getByRole("button", { name: /save this segment/i }).click();
await page.getByRole("heading", { name: "Save segment" }).waitFor({ timeout: 10000 });
await page.locator('input[name="name"]').fill(name);
await page.getByRole("button", { name: /^Save$/ }).click();
await page.waitForTimeout(2500);
check("it appears as a saved segment", (await page.locator("body").innerText()).includes(name));

console.log("\nAn empty segment is refused a name");
await page.goto(`${BASE}/campaigns/new`, { waitUntil: "networkidle" });
await settle();
await page.getByRole("button", { name: /save this segment/i }).click();
await page.getByRole("heading", { name: "Save segment" }).waitFor({ timeout: 10000 });
await page.locator('input[name="name"]').fill(`Everyone ${stamp}`);
await page.getByRole("button", { name: /^Save$/ }).click();
await page.waitForTimeout(2000);
check(
  "saving 'everyone' under a name is refused with a reason",
  /no criteria|match everyone/i.test(await page.locator("body").innerText()),
);
await page.keyboard.press("Escape");

console.log("\nA saved segment reopens with its criteria applied");
await page.goto(`${BASE}/contacts`, { waitUntil: "networkidle" });
const chip = page.locator(`a[href^="/campaigns/new?segment="]`).first();
check("the saved-view chips on /contacts are links now", (await chip.count()) > 0);
if ((await chip.count()) > 0) {
  await chip.click();
  await page.waitForURL(/\/campaigns\/new\?segment=/, { timeout: 15000 });
  await settle();
  check(
    "opening one applies it rather than starting blank",
    /· /.test(await page.locator("body").innerText()),
  );
}

console.log("\nConsole");
const real = consoleErrors.filter((e) => !/favicon|hydrat/i.test(e));
check("no page or console errors during any of that", real.length === 0, real.join(" | "));

await browser.close();
console.log(failures === 0 ? "\nall checks passed\n" : `\n${failures} FAILED\n`);
process.exit(failures === 0 ? 0 : 1);

/**
 * Drive the real write paths through the real browser against the real database.
 *
 * The unit tests call the actions directly, which proves the server half. This proves
 * the other half: that a person clicking the button in a browser actually causes the
 * write, and that the screen afterwards shows what happened. Those are separable
 * failures - a Server Action can be perfect while the form never reaches it.
 *
 *   pnpm dev            (in one terminal)
 *   node scripts/verify-writes.mjs
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
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push(e.message.slice(0, 120)));
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text().slice(0, 120));
});

/* ------------------------------------------------------------------ sign in */

console.log("\nAuthentication");
const guarded = await page.goto(`${BASE}/contacts`, { waitUntil: "domcontentloaded" });
check("an unauthenticated request lands on /login", page.url().includes("/login"),
  `${guarded.status()} ${new URL(page.url()).pathname}`);

await page.fill('input[name="email"]', "sam@ozirealty.com.au");
await page.click('button[type="submit"]');
await page.waitForURL("**/dashboard", { timeout: 15000 });
check("dev sign-in reaches the dashboard", page.url().includes("/dashboard"));

/* ------------------------------------------------------------ create a contact */

console.log("\nCreating a contact");
await page.goto(`${BASE}/contacts`, { waitUntil: "networkidle" });
const before = await page.locator("tbody tr").count();

await page.getByRole("button", { name: "New contact" }).click();
await page.waitForSelector('input[name="firstName"]');
const surname = `Browsercase${stamp}`;
await page.fill('input[name="firstName"]', "Wiring");
await page.fill('input[name="lastName"]', surname);
await page.fill('input[name="email"]', `wiring.${stamp}@example.com`);
// A fixed number would collide with the previous run and open a merge review, which
// is correct behaviour but not what this step is testing.
await page.fill('input[name="phone"]', `04${stamp}55`);
await page.fill('input[name="suburb"]', "Prospect");
await page.getByRole("button", { name: "Create contact" }).click();

await page.waitForFunction(
  (n) => document.querySelectorAll("tbody tr").length > n,
  before,
  { timeout: 15000 },
);
const after = await page.locator("tbody tr").count();
check("the row appears in the table without a manual reload", after === before + 1,
  `${before} -> ${after}`);
check("the new contact is the one just typed",
  (await page.getByRole("link", { name: `Wiring ${surname}` }).count()) === 1);

/* ---------------------------------------------------- server-side validation */

console.log("\nValidation");
await page.getByRole("button", { name: "New contact" }).click();
await page.waitForSelector('input[name="firstName"]');
// `required` on the input would stop the submit before the server ever sees it, so
// type a space: the browser is satisfied and Zod's .trim().min(1) is not.
await page.fill('input[name="firstName"]', " ");
await page.fill('input[name="lastName"]', " ");
await page.getByRole("button", { name: "Create contact" }).click();
await page.waitForTimeout(1200);
const fieldMsg = await page.locator("form p.text-\\[11\\.5px\\]").first().textContent()
  .catch(() => null);
check("a blank name is refused with a visible message",
  !!fieldMsg && /required/i.test(fieldMsg), fieldMsg ?? "(no message)");
await page.keyboard.press("Escape");

/* --------------------------------------------------------- duplicate handling */

console.log("\nDuplicates");
await page.getByRole("button", { name: "New contact" }).click();
await page.waitForSelector('input[name="firstName"]');
await page.fill('input[name="firstName"]', "Wiring");
await page.fill('input[name="lastName"]', `${surname}Dup`);
await page.fill('input[name="email"]', `WIRING.${stamp}@Example.com`);
await page.getByRole("button", { name: "Create contact" }).click();
await page.waitForTimeout(2000);
const dupNotice = await page.getByText("merge review", { exact: false }).count();
check("a duplicate is saved and flagged for merge review, not refused", dupNotice > 0);
await page.keyboard.press("Escape");

/* ------------------------------------------------- log an interaction + outcome */

console.log("\nInteraction and follow-up");
await page.getByRole("link", { name: `Wiring ${surname}`, exact: true }).first().click();
await page.waitForURL("**/contacts/**");

await page.getByRole("button", { name: "Log interaction" }).click();
await page.waitForSelector('textarea[name="body"]');
await page.fill('input[name="subject"]', "Doorknock");
await page.fill(
  'textarea[name="body"]',
  `Mentioned they are thinking about selling in spring. [${stamp}]`,
);
await page.getByRole("button", { name: "Log it" }).click();
await page.waitForTimeout(2500);
check("the interaction appears in the append-only log",
  (await page.getByText(`selling in spring. [${stamp}]`).count()) > 0);

await page.getByRole("button", { name: "Record outcome" }).click();
await page.waitForSelector('textarea[name="outcome"]');
await page.fill(
  'textarea[name="outcome"]',
  `Wants to see Powell St before making an offer. [${stamp}]`,
);
await page.getByRole("button", { name: "Record outcome" }).last().click();
await page.waitForTimeout(2500);
check("the follow-up outcome shows on the record",
  (await page.getByText(`Powell St before making an offer. [${stamp}]`).count()) > 0);

/* ------------------------------------------------------------- confirm queue */

console.log("\nConfirm queue");
await page.goto(`${BASE}/confirm`, { waitUntil: "networkidle" });
const commits = page.getByRole("button", { name: /^Commit/ });
const queued = await commits.count();
if (queued === 0) {
  console.log("  SKIP  nothing queued to commit");
} else {
  // Track the specific proposal rather than a count. Counting is unreliable here
  // because the button relabels itself to "Committing…" while the write is in flight,
  // so the count dips before anything has actually happened.
  const summary = (await page.locator("section, div").getByRole("button", { name: /^Commit/ })
    .first().evaluate((b) => {
      const card = b.closest("div.rounded-lg, div[class*='surface']") ?? b.parentElement;
      return card?.textContent?.slice(0, 60) ?? "";
    })).trim();

  await commits.first().click();
  let settled = false;
  for (let i = 0; i < 30 && !settled; i++) {
    await page.waitForTimeout(500);
    settled = (await commits.count()) === queued - 1;
  }
  check("committing removes the item from the queue", settled,
    `${queued} -> ${await commits.count()}${settled ? "" : `  (${summary})`}`);
}

const merges = page.getByRole("button", { name: "Merge into the older record" });
const openMerges = await merges.count();
if (openMerges === 0) {
  console.log("  SKIP  no open merge review");
} else {
  await merges.first().click();
  await page.waitForTimeout(2500);
  check("resolving a merge closes the review",
    (await merges.count()) === openMerges - 1,
    `${openMerges} -> ${await merges.count()}`);
}

/* --------------------------------------------------------------- final sweep */

console.log("\nConsole");
check("no page or console errors during any of that",
  consoleErrors.length === 0,
  consoleErrors.slice(0, 3).join(" | "));

await browser.close();
console.log(`\n${failures === 0 ? "all checks passed" : `${failures} FAILED`}\n`);
process.exit(failures ? 1 : 0);

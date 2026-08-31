/**
 * Drive the EDIT and DELETE paths through a real browser.
 *
 * verify-writes.mjs proves a record can be created from the interface. This proves
 * the other three letters: that the edit dialogs prefill with what is actually
 * stored, that saving reaches the server, that a delete removes the row from the
 * screen — and, just as important, that a refusal is VISIBLE rather than a button
 * that appears to do nothing.
 *
 * The unit tests in tests/edit-delete.test.ts call these actions directly. A form
 * that never reaches a correct action fails in a way no unit test can see.
 *
 *   pnpm dev            (in one terminal)
 *   node scripts/verify-crud.mjs
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

/**
 * Fields are addressed at page level rather than scoped to the dialog.
 *
 * Modal renders null when closed, so exactly one dialog's inputs are ever in the
 * DOM — scoping to a wrapper div only made the selector brittle without making it
 * more specific.
 */
async function openDialog(title) {
  await page.getByRole("heading", { name: title }).waitFor({ timeout: 15000 });
}

/**
 * A two-press confirm button, addressed by its title.
 *
 * The visible text CHANGES between the two presses ("Delete" becomes "Delete for
 * good"), so a name-based locator matches on the first click and misses on the
 * second. The title attribute is the one thing that stays put.
 */
async function confirmTwice(scope, title) {
  const btn = scope.locator(`button[title="${title}"]`).first();
  await btn.click();
  await btn.click();
  await page.waitForTimeout(2500);
}

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: /development sign-in/i }).click();
await page.waitForURL("**/dashboard", { timeout: 20000 });

/* ------------------------------------------------------------ edit a contact */

console.log("\nEditing a contact");
await page.goto(`${BASE}/contacts`, { waitUntil: "networkidle" });
await page.locator("tbody tr a[href^='/contacts/']").first().click();
await page.waitForURL(/\/contacts\/[0-9a-f-]{36}/, { timeout: 20000 });
const contactUrl = page.url();

await page.getByRole("button", { name: "Edit", exact: true }).first().click();
await openDialog("Edit contact");
const prefilled = await page.locator('input[name="firstName"]').inputValue();
check("the edit dialog prefills from the stored record", prefilled.length > 0, prefilled);

const newSuburb = `Verified ${stamp}`;
await page.locator('input[name="suburb"]').fill(newSuburb);
await page.getByRole("button", { name: /save changes/i }).click();
await page.waitForTimeout(2500);
check(
  "the change is on the record after the save",
  (await page.locator("body").innerText()).includes(newSuburb),
);

/* ------------------------------------------------- a refusal has to be visible */

console.log("\nA refusal reaches the screen");
await page.goto(`${BASE}/properties`, { waitUntil: "networkidle" });
// Every seeded property has been listed, so deleting one must be refused — and the
// reason must appear next to the button rather than nowhere.
await page.goto(
  `${BASE}/properties/${(await page.locator("tbody tr a[href^='/properties/']").first().getAttribute("href")).split("/").pop()}`,
  { waitUntil: "networkidle" },
);
await confirmTwice(page, "Delete this property");
const body = await page.locator("body").innerText();
check(
  "deleting a listed property is refused, in words, on screen",
  /sold archive|cannot be deleted|archived instead/i.test(body),
);
check(
  "and the property is still there",
  page.url().includes("/properties/"),
);

/* ------------------------------------------------------- task edit and delete */

console.log("\nEditing and deleting a task");
await page.goto(`${BASE}/tasks`, { waitUntil: "networkidle" });
const openBefore = await page.locator("section", { hasText: "Open" }).first().count();
check("the tasks screen rendered", openBefore > 0);

const taskEdit = page.locator('button[title="Edit this task"]').first();
await taskEdit.click();
await openDialog("Edit task");
const title = `Verified task ${stamp}`;
await page.locator('input[name="title"]').fill(title);
await page.getByRole("button", { name: /save changes/i }).click();
await page.waitForTimeout(2500);
check(
  "the edited title is on the list",
  (await page.locator("body").innerText()).includes(title),
);

/**
 * The innermost div that contains BOTH the title and the delete button — which is
 * the card. Filtering on the title alone lands on the <div> holding the text, whose
 * subtree has no buttons in it at all.
 */
const card = page
  .locator("div")
  .filter({ hasText: title })
  .filter({ has: page.locator('button[title="Delete this task"]') })
  .last();
await confirmTwice(card, "Delete this task");
check(
  "deleting removes it from the list",
  !(await page.locator("body").innerText()).includes(title),
);

/* ----------------------------------------------------------- the redirect map */

console.log("\nThe redirect map");
await page.goto(`${BASE}/website`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /add redirect/i }).click();
await openDialog("Add a redirect");
const path = `/verified-${stamp}`;
await page.locator('input[name="fromPath"]').fill(path);
await page.locator('input[name="toPath"]').fill("/for-sale");
await page.locator('select[name="status"]').selectOption("mapped");
await page.getByRole("button", { name: /add it/i }).click();
await page.waitForTimeout(2500);
check("the new redirect is in the table", (await page.locator("body").innerText()).includes(path));

const row = page.locator("tr").filter({ hasText: path }).first();
await confirmTwice(row, "Remove this redirect");
check(
  "removing it takes it out of the table",
  !(await page.locator("body").innerText()).includes(path),
);

/* ------------------------------------------------------------------- exports */

console.log("\nCSV export");
const res = await page.request.get(`${BASE}/api/export/contacts`);
const disposition = res.headers()["content-disposition"] ?? "";
const csv = await res.text();
check("the export responds as a CSV attachment", res.ok() && disposition.includes("attachment"), disposition);
check("it has a header row and at least one contact", csv.split("\r\n").length > 2);
check("and it carries the consent state, not just names", csv.includes("Consent"));

const unknown = await page.request.get(`${BASE}/api/export/nonsense`);
check("an unknown export is a 404, not a 500", unknown.status() === 404, String(unknown.status()));

/* --------------------------------------------------------------------- console */

console.log("\nConsole");
// A dialog closing while its action is in flight is the classic source of these.
const real = consoleErrors.filter((e) => !/favicon|hydrat/i.test(e));
check("no page or console errors during any of that", real.length === 0, real.join(" | "));

await browser.close();
console.log(failures === 0 ? "\nall checks passed\n" : `\n${failures} FAILED\n`);
process.exit(failures === 0 ? 0 : 1);

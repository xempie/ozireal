/**
 * Exercise every "New …" form against the DEPLOYED site, as a person would:
 * open the dialog, fill it, submit, and check the row actually appears.
 *
 * Also submits the things that MUST be refused (a duplicate address), because a
 * guard nobody has watched fail on the real deployment is a guard on paper.
 *
 *   node scripts/verify-forms-live.mjs https://crm.ozirealty.com.au <password>
 */
import { chromium } from "playwright";

const base = process.argv[2];
const password = process.argv[3];
const stamp = process.argv[4]; // shared marker, so cleanup can find every row
let failures = 0;

function ok(what) { console.log(`  PASS  ${what}`); }
function bad(what, detail) { failures++; console.log(`  FAIL  ${what}${detail ? ` — ${detail}` : ""}`); }

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
const p = await ctx.newPage();
const pageErrors = [];
p.on("pageerror", (e) => pageErrors.push(e.message));

/** The dialog's own error banner, which is what a refusal must look like. */
async function alertText() {
  const a = p.locator('[role="alert"]');
  return (await a.count()) ? (await a.first().innerText()).trim() : null;
}
async function submit(label) {
  await p.getByRole("button", { name: label, exact: false }).last().click();
  await p.waitForTimeout(2500);
}
async function openForm(button) {
  await p.getByRole("button", { name: button }).first().click();
  await p.waitForTimeout(500);
}

// ---------------------------------------------------------------- sign in
await p.goto(`${base}/login`, { waitUntil: "networkidle" });
await p.fill('input[name="email"]', "sam@ozirealty.com.au");
await p.fill('input[name="password"]', password);
await p.getByRole("button", { name: /sign in/i }).click();
await p.waitForTimeout(4000);
if (p.url().includes("/login")) { bad("sign in", `still on ${p.url()}`); process.exit(1); }
ok("signed in");

// -------------------------------------------------------------- property
const street = `Verify ${stamp} Street`;
console.log("\nNew property");
await p.goto(`${base}/properties`, { waitUntil: "networkidle" });
await openForm("New property");
if (!(await p.locator('select[name="suburbId"]').count())) {
  bad("property dialog opened");
} else {
  await p.fill('input[name="streetNumber"]', "12");
  await p.fill('input[name="street"]', street);
  const subOpts = await p.locator('select[name="suburbId"] option').all();
  await p.locator('select[name="suburbId"]').selectOption(await subOpts[1].getAttribute("value"));
  await p.fill('input[name="beds"]', "3");
  await p.fill('input[name="baths"]', "2");
  await submit("Add property");
  const err = await alertText();
  if (err) bad("property created", err);
  else {
    await p.goto(`${base}/properties`, { waitUntil: "networkidle" });
    (await p.getByText(street).count()) ? ok("property created and listed on the page")
      : bad("property created", "saved but not shown on /properties");
  }

  // The refusal. A second row for one house can never be merged away.
  await openForm("New property");
  await p.fill('input[name="streetNumber"]', "12");
  await p.fill('input[name="street"]', street);
  await p.locator('select[name="suburbId"]').selectOption(await subOpts[1].getAttribute("value"));
  await submit("Add property");
  const dupe = await alertText();
  dupe && /already in your stock/i.test(dupe)
    ? ok(`duplicate address refused: "${dupe.slice(0, 60)}…"`)
    : bad("duplicate address refused", dupe ?? "it was accepted");
  await p.keyboard.press("Escape");
}

// --------------------------------------------------------------- listing
console.log("\nNew listing");
await p.goto(`${base}/listings`, { waitUntil: "networkidle" });
await openForm("New listing");
if (!(await p.locator('select[name="propertyId"]').count())) {
  bad("listing dialog offered a property to list");
} else {
  const opts = await p.locator('select[name="propertyId"] option').allTextContents();
  const idx = opts.findIndex((t) => t.includes(street));
  if (idx < 0) bad("listing dialog", "the new property was not in the picker");
  else {
    const v = await p.locator('select[name="propertyId"] option').nth(idx).getAttribute("value");
    await p.locator('select[name="propertyId"]').selectOption(v);
    await p.fill('input[name="priceDisplay"]', "Offers above $750,000");
    await p.fill('input[name="searchPriceMin"]', "750000");
    await p.fill('input[name="searchPriceMax"]', "800000");
    await p.fill('input[name="publicHeadline"]', `Verification listing ${stamp}`);
    await submit("Create draft listing");
    const err = await alertText();
    if (err) bad("listing created", err);
    else {
      await p.goto(`${base}/listings`, { waitUntil: "networkidle" });
      const body = await p.locator("body").innerText();
      body.includes(street) && /draft/i.test(body)
        ? ok("listing created as a draft")
        : bad("listing created", "not shown as a draft on /listings");
    }
  }
}

// ------------------------------------------------------------------ task
console.log("\nNew task");
const taskTitle = `Verification task ${stamp}`;
await p.goto(`${base}/tasks`, { waitUntil: "networkidle" });
await openForm("New task");
if (!(await p.locator('input[name="title"]').count())) bad("task dialog opened");
else {
  await p.fill('input[name="title"]', taskTitle);
  await submit("Add task");
  const err = await alertText();
  if (err) bad("task created", err);
  else {
    await p.goto(`${base}/tasks`, { waitUntil: "networkidle" });
    if (!(await p.getByText(taskTitle).count())) bad("task created", "not shown on /tasks");
    else {
      ok("task created");
      // The INNERMOST element that holds both the title and a Done button —
      // filtering on text alone lands on the title <div>, which has no button in it.
      const row = p
        .locator("div")
        .filter({ hasText: taskTitle })
        .filter({ has: p.getByRole("button", { name: /done/i }) })
        .last();
      const done = row.getByRole("button", { name: /done/i });
      if (!(await done.count())) bad("task completed", "no Done button on the row");
      else {
        await done.first().click();
        await p.waitForTimeout(2500);
        await p.goto(`${base}/tasks`, { waitUntil: "networkidle" });
        /**
         * It must have MOVED to "Recently completed", where the title is struck
         * through. Asking instead whether some ancestor still holds a Done button
         * is useless: the page container holds every OTHER open task's button too.
         */
        const struck = await p.locator("div.line-through").filter({ hasText: taskTitle }).count();
        struck
          ? ok("task completed and moved to Recently completed")
          : bad("task completed", "still sitting in Open");
      }
    }
  }
}

// ---------------------------------------------------------------- calendar
console.log("\nNew calendar event");
const eventTitle = `Verification inspection ${stamp}`;
await p.goto(`${base}/calendar`, { waitUntil: "networkidle" });
await openForm("New event");
if (!(await p.locator('input[name="startsAt"]').count())) bad("event dialog opened");
else {
  await p.fill('input[name="title"]', eventTitle);
  await submit("Add event");
  const err = await alertText();
  if (err) bad("event created", err);
  else {
    await p.goto(`${base}/calendar`, { waitUntil: "networkidle" });
    (await p.getByText(eventTitle).count())
      ? ok("calendar event created and shown")
      : bad("event created", "saved but not shown on /calendar");
  }
}

console.log(`\npage errors: ${pageErrors.length}${pageErrors.length ? ` — ${pageErrors[0]}` : ""}`);
console.log(failures ? `\nFAILURES: ${failures}` : "\nevery form works on the live site");
await b.close();
process.exit(failures ? 1 : 0);

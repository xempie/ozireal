/**
 * Exercise every "New …" form against the DEPLOYED site, as a person would:
 * open the dialog, fill it, submit, and check the row actually appears.
 *
 * Also submits the things that MUST be refused — a duplicate address, half a price
 * estimate — because a guard nobody has watched fail on the real deployment is a
 * guard on paper.
 *
 *   node scripts/verify-forms-live.mjs https://crm.ozirealty.com.au <password> <stamp>
 *
 * The stamp marks every row this run creates, so cleanup can find them all.
 */
import { chromium } from "playwright";

const base = process.argv[2];
const password = process.argv[3];
const stamp = process.argv[4];
let failures = 0;

function ok(what) { console.log(`  PASS  ${what}`); }
function bad(what, detail) { failures++; console.log(`  FAIL  ${what}${detail ? ` — ${detail}` : ""}`); }
function head(what) { console.log(""); console.log(what); }

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
async function bodyText(route) {
  await p.goto(base + route, { waitUntil: "networkidle" });
  return p.locator("body").innerText();
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
head("New property");
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
    (await bodyText("/properties")).includes(street)
      ? ok("property created and listed on the page")
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
    ? ok(`duplicate address refused: "${dupe.slice(0, 55)}…"`)
    : bad("duplicate address refused", dupe ?? "it was accepted");
  await p.keyboard.press("Escape");
}

// --------------------------------------------------------------- listing
head("New listing");
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
      const body = await bodyText("/listings");
      body.includes(street) && /draft/i.test(body)
        ? ok("listing created as a draft")
        : bad("listing created", "not shown as a draft on /listings");
    }
  }
}

// ------------------------------------------------------------------ task
head("New task");
const taskTitle = `Verification task ${stamp}`;
await p.goto(`${base}/tasks`, { waitUntil: "networkidle" });
await openForm("New task");
if (!(await p.locator('input[name="title"]').count())) bad("task dialog opened");
else {
  await p.fill('input[name="title"]', taskTitle);
  await submit("Add task");
  const err = await alertText();
  if (err) bad("task created", err);
  else if (!(await bodyText("/tasks")).includes(taskTitle)) bad("task created", "not shown on /tasks");
  else {
    ok("task created");
    /**
     * The INNERMOST element holding both the title and a Done button. Filtering on
     * text alone lands on the title div, which has no button inside it.
     */
    const row = p
      .locator("div")
      .filter({ hasText: taskTitle })
      .filter({ has: p.getByRole("button", { name: /done/i }) })
      .last();
    if (!(await row.count())) bad("task completed", "no Done button on the row");
    else {
      await row.getByRole("button", { name: /done/i }).first().click();
      await p.waitForTimeout(2500);
      await p.goto(`${base}/tasks`, { waitUntil: "networkidle" });
      /**
       * It must have MOVED to "Recently completed", where the title is struck
       * through. Asking whether some ancestor still holds a Done button is
       * useless: the page container holds every other open task's button too.
       */
      (await p.locator("div.line-through").filter({ hasText: taskTitle }).count())
        ? ok("task completed and moved to Recently completed")
        : bad("task completed", "still sitting in Open");
    }
  }
}

// ---------------------------------------------------------------- calendar
head("New calendar event");
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
    (await bodyText("/calendar")).includes(eventTitle)
      ? ok("calendar event created and shown")
      : bad("event created", "saved but not shown on /calendar");
  }
}

// ---------------------------------------------------------------- campaign
head("New campaign");
const campaignName = `Verification campaign ${stamp}`;
await p.goto(`${base}/campaigns`, { waitUntil: "networkidle" });
await openForm("New campaign");
if (!(await p.locator('input[name="name"]').count())) bad("campaign dialog opened");
else {
  await p.fill('input[name="name"]', campaignName);
  await submit("Create draft campaign");
  const err = await alertText();
  if (err) bad("campaign created", err);
  else {
    const body = await bodyText("/campaigns");
    body.includes(campaignName) && /draft/i.test(body)
      ? ok("campaign created as a draft")
      : bad("campaign created", "not shown as a draft on /campaigns");
  }
}

// ----------------------------------------------------------------- content
head("New draft — article, then social post");
const articleTitle = `Verification article ${stamp}`;
const socialBody = `Verification social ${stamp}`;
await p.goto(`${base}/content`, { waitUntil: "networkidle" });
await openForm("New draft");
if (!(await p.locator('input[name="title"]').count())) bad("draft dialog opened");
else {
  await p.fill('input[name="title"]', articleTitle);
  await p.fill('textarea[name="body"]', "One two three four five.");
  await submit("Save draft");
  const err = await alertText();
  if (err) bad("article drafted", err);
  else {
    (await bodyText("/content")).includes(articleTitle)
      ? ok("article drafted")
      : bad("article drafted", "not shown on /content");
  }

  // The other half of the same dialog writes to a different table.
  await openForm("New draft");
  await p.getByRole("button", { name: "Social post", exact: true }).click();
  await p.waitForTimeout(400);
  await p.fill('textarea[name="body"]', socialBody);
  await submit("Save draft");
  const e2 = await alertText();
  if (e2) bad("social post drafted", e2);
  else {
    (await bodyText("/content")).includes(socialBody)
      ? ok("social post drafted")
      : bad("social post drafted", "not shown on /content");
  }
}

// ----------------------------------------------------------------- contact
head("New contact");
const contactLast = `Vendor${stamp}`;
await p.goto(`${base}/contacts`, { waitUntil: "networkidle" });
await openForm("New contact");
if (!(await p.locator('input[name="firstName"]').count())) bad("contact dialog opened");
else {
  await p.fill('input[name="firstName"]', "Verification");
  await p.fill('input[name="lastName"]', contactLast);
  await p.fill('input[name="email"]', `verify.${stamp}@example.invalid`);
  await submit("Create contact");
  const err = await alertText();
  if (err) bad("contact created", err);
  else {
    (await bodyText("/contacts")).includes(contactLast)
      ? ok("contact created")
      : bad("contact created", "not shown on /contacts");
  }
}

// ---------------------------------------------------------------- proposal
// Runs after the contact, deliberately: a proposal is addressed to a person, and
// on a fresh tenant there is nobody to address it to until one exists.
head("New proposal");
await p.goto(`${base}/proposals`, { waitUntil: "networkidle" });
await openForm("New proposal");
if (!(await p.locator('select[name="contactId"]').count())) bad("proposal dialog opened");
else {
  const cOpts = await p.locator('select[name="contactId"] option').all();
  if (cOpts.length < 2) bad("proposal dialog", "no contacts to choose from");
  else {
    await p.locator('select[name="contactId"]').selectOption(await cOpts[1].getAttribute("value"));
    // Half a range first: an appraisal quoted as one figure must be refused.
    await p.fill('input[name="estimateLow"]', "750000");
    await submit("Create draft proposal");
    const half = await alertText();
    half && /both a low and a high/i.test(half)
      ? ok(`half an estimate refused: "${half.slice(0, 50)}…"`)
      : bad("half an estimate refused", half ?? "it was accepted");

    await p.fill('input[name="estimateHigh"]', "800000");
    await submit("Create draft proposal");
    const err = await alertText();
    err ? bad("proposal created", err) : ok("proposal created with a full range");
  }
}

console.log("");
console.log(`page errors: ${pageErrors.length}${pageErrors.length ? ` — ${pageErrors[0]}` : ""}`);
console.log("");
console.log(failures ? `FAILURES: ${failures}` : "every form works on the live site");
await b.close();
process.exit(failures ? 1 : 0);

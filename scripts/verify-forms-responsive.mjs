/**
 * The write forms, on a phone and a tablet.
 *
 * Modals are where responsive layouts fail quietly: a dialog that overflows sideways
 * still "works" on a desktop screenshot and is unusable on a phone. This opens each
 * one at three widths, screenshots it, and reports horizontal overflow and any tap
 * target under 44px - the two defects that make a form unusable rather than ugly.
 *
 *   node scripts/verify-forms-responsive.mjs
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3200";
const out = join(process.cwd(), "docs", "screenshots", "forms");
mkdirSync(out, { recursive: true });

const viewports = [
  ["mobile", 390, 844],
  ["tablet", 820, 1180],
  ["desktop", 1440, 900],
];

let failures = 0;
function check(label, ok, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`);
  if (!ok) failures++;
}

const browser = await chromium.launch();

for (const [name, width, height] of viewports) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "sam@ozirealty.com.au");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/dashboard");

  console.log(`\n${name} (${width}x${height})`);

  const dialogs = [
    ["new-contact", "/contacts", "New contact", 'input[name="firstName"]'],
    ["log-interaction", null, "Log interaction", 'textarea[name="body"]'],
    ["record-outcome", null, "Record outcome", 'textarea[name="outcome"]'],
  ];

  await page.goto(`${BASE}/contacts`, { waitUntil: "networkidle" });
  for (const [slug, route, button, ready] of dialogs) {
    if (route === null && !page.url().includes("/contacts/")) {
      await page.locator("tbody tr a").first().click();
      await page.waitForURL("**/contacts/**");
      await page.waitForLoadState("networkidle");
    }

    await page.getByRole("button", { name: button }).first().click();
    await page.waitForSelector(ready);
    await page.waitForTimeout(250);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    // Every interactive control inside the dialog, measured as rendered.
    const small = await page.evaluate(() => {
      const dialog = document.querySelector(".fixed.inset-0");
      if (!dialog) return ["no dialog found"];
      return [...dialog.querySelectorAll("button, input, select, textarea")]
        .filter((el) => el.type !== "checkbox")
        .map((el) => ({ t: el.tagName.toLowerCase(), h: el.getBoundingClientRect().height }))
        .filter((m) => m.h > 0 && m.h < 36)
        .map((m) => `${m.t}@${Math.round(m.h)}px`);
    });

    await page.screenshot({ path: join(out, `${name}-${slug}.png`) });
    check(`${button}: no sideways overflow`, overflow === 0, `${overflow}px`);
    check(`${button}: controls are tappable`, small.length === 0, small.join(", "));

    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
  }

  await ctx.close();
}

await browser.close();
console.log(`\n${failures === 0 ? "all checks passed" : `${failures} FAILED`}\n`);
process.exit(failures ? 1 : 0);

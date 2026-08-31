/**
 * The public home page, on a desktop and a phone.
 *
 * The mobile menu is the thing this exists for. It is a client drawer clipped by
 * max-height and overflow:hidden, which Playwright's isVisible() does not model - so a
 * naive check reports the closed drawer as visible and passes whatever it is doing.
 * These checks measure the container instead, and assert the parts that actually make a
 * drawer usable: it opens, Escape shuts it, tapping an item shuts it, the page behind is
 * scroll-locked while it is open, and the burger is a 44px tap target.
 *
 * It also walks the page to force lazy images in before screenshotting - a fullPage
 * capture without that shows empty boxes where the suburb and journal photography is,
 * which reads as broken and is not.
 *
 *   pnpm dev            # or next start
 *   pnpm verify:public
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.BASE ?? "http://localhost:3200";
const out = join(process.cwd(), "docs", "screenshots", "public");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
let fails = 0;
const check = (label, ok, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  — ${detail}` : ""}`);
  if (!ok) fails++;
};

/** The drawer is clipped by max-height + overflow:hidden, which Playwright's
 *  isVisible() does not model. Measure the container instead. */
const menuOpen = (page) =>
  page.evaluate(() => document.getElementById("site-menu").getBoundingClientRect().height > 10);

/** Walk the page so lazy images enter the viewport, then wait for decode. */
async function loadAllImages(page) {
  await page.evaluate(async () => {
    const step = window.innerHeight;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(600);
}

/* ------------------------------------------------------------- desktop */
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(BASE, { waitUntil: "networkidle" });

  check("burger hidden on desktop", !(await page.locator(".burger").isVisible()));
  check("nav CTA visible on desktop", await page.locator(".nav-cta .btn").isVisible());
  check("ticker rendered", await page.locator(".ticker-track .tick").first().isVisible());
  check("six cards", (await page.locator(".card").count()) === 6);

  await page.getByRole("button", { name: "Auction" }).click();
  await page.waitForTimeout(150);
  check("auction chip narrows to 2", (await page.locator(".card").count()) === 2);
  await page.getByRole("button", { name: "Everything" }).click();
  await page.waitForTimeout(150);
  check("everything chip restores 6", (await page.locator(".card").count()) === 6);

  // The hero search panel is deliberately out for now; it must not reappear by accident.
  check("no search panel in the hero", (await page.locator(".hero .search").count()) === 0);

  /*
    The services accordion is exclusive via <details name="services">, so opening one
    panel must close the other three. Asserted by clicking rather than by reading the
    attribute, because the attribute is only a promise the browser has to keep.
  */
  const openCount = () => page.locator(".svc[open]").count();
  check("one service panel open on load", (await openCount()) === 1, `${await openCount()} open`);
  for (const name of ["Property management", "Buyer advocacy", "Investment & land"]) {
    await page.locator(".svc-top", { hasText: name }).click();
    await page.waitForTimeout(200);
    const n = await openCount();
    const isOnlyOne =
      n === 1 && (await page.locator(".svc[open] .svc-name").innerText()).includes(name);
    check(`opening "${name}" closes the others`, isOnlyOne, `${n} open`);
  }
  // Clicking the open one shuts it, rather than trapping the reader in an open panel.
  await page.locator(".svc[open] .svc-top").click();
  await page.waitForTimeout(200);
  check("clicking the open panel closes it", (await openCount()) === 0);

  await loadAllImages(page);

  // Every <img> that reached the DOM must have actually decoded.
  const broken = await page.evaluate(() =>
    [...document.images]
      .filter((i) => !i.complete || i.naturalWidth === 0)
      .map((i) => (i.currentSrc || i.src).slice(0, 90)),
  );
  check("no broken images", broken.length === 0, broken.join(" | "));
  const imgCount = await page.evaluate(() => document.images.length);
  check("all section photography present", imgCount >= 15, `${imgCount} images`);

  // The suburb tiles are portrait (3/3.6); a collapsed one means aspect-ratio lost.
  const sub = await page.locator(".sub").first().boundingBox();
  check("suburb tile is portrait", sub.height > sub.width, `${Math.round(sub.width)}x${Math.round(sub.height)}`);

  const docW = await page.evaluate(() => document.documentElement.scrollWidth);
  check("no horizontal overflow (1440)", docW <= 1440, `scrollWidth ${docW}`);

  await page.screenshot({ path: `${out}/desktop-full.png`, fullPage: true });
  await page.close();
}

/* -------------------------------------------------------------- mobile */
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(BASE, { waitUntil: "networkidle" });

  const burger = page.locator(".burger");
  check("burger visible on mobile", await burger.isVisible());
  check("drawer closed initially", !(await menuOpen(page)));
  const box = await burger.boundingBox();
  check("burger tap target >= 44px", box.width >= 44 && box.height >= 44, `${Math.round(box.width)}x${Math.round(box.height)}`);

  await burger.click();
  await page.waitForTimeout(450);
  check("drawer opens", await menuOpen(page));
  check("aria-expanded true", (await burger.getAttribute("aria-expanded")) === "true");
  check("appraisal CTA in drawer", await page.locator(".menu-cta").isVisible());
  check(
    "page behind is scroll-locked",
    (await page.evaluate(() => getComputedStyle(document.body).overflow)) === "hidden",
  );

  await page.keyboard.press("Escape");
  await page.waitForTimeout(450);
  check("Escape closes drawer", !(await menuOpen(page)));
  check("aria-expanded false again", (await burger.getAttribute("aria-expanded")) === "false");
  check(
    "scroll lock released",
    (await page.evaluate(() => getComputedStyle(document.body).overflow)) !== "hidden",
  );

  await burger.click();
  await page.waitForTimeout(450);
  await page.locator("#site-menu a", { hasText: "Suburbs" }).click();
  await page.waitForTimeout(600);
  check("tapping a drawer link closes it", !(await menuOpen(page)));

  const docW = await page.evaluate(() => document.documentElement.scrollWidth);
  check("no horizontal overflow (390)", docW <= 390, `scrollWidth ${docW}`);

  await loadAllImages(page);
  await page.screenshot({ path: `${out}/mobile-full.png`, fullPage: true });
  await page.close();
}

await browser.close();
console.log(fails === 0 ? "\nAll checks passed." : `\n${fails} check(s) failed.`);
process.exit(fails === 0 ? 0 : 1);

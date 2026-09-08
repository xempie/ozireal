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
import { mkdirSync, readFileSync } from "node:fs";
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

/**
 * Contrast of the hero text against the photograph actually behind it.
 *
 * The heroes put paper-coloured type over a photo dimmed by two gradients, so the
 * contrast depends on the image, not just on the CSS. Lightening the overlay to show
 * the photograph is exactly the change that quietly pushes the lede below legibility,
 * which is why this measures instead of trusting the numbers.
 *
 * Method: hide the type, screenshot the band it occupies, then read the pixels back
 * through a canvas. The worst (lightest) pixel is the one that decides, so that is what
 * is scored, not the average.
 */
async function heroContrast(page, heroSel, textSel) {
  const box = await page.locator(textSel).first().boundingBox();
  if (!box) return null;
  const hide = await page.addStyleTag({
    content: `${heroSel} h1, ${heroSel} .lede, ${heroSel} .eyebrow, ${heroSel} .phero-facts, ${heroSel} .search, ${heroSel} .ticker { visibility: hidden !important; }`,
  });
  // A data URL, not file://: the probe page is about:blank and cannot read a local file.
  const shot = join(out, "_contrast.png");
  await page.screenshot({ path: shot, clip: box });
  await hide.evaluate((n) => n.remove());

  // browser.newPage() rather than page.context().newPage(): the implicit context a
  // browser-level page gets refuses a second page.
  const probe = await browser.newPage();
  const lightest = await probe.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const lum = (r, gg, b) => {
      const f = (v) => {
        v /= 255;
        return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(r) + 0.7152 * f(gg) + 0.0722 * f(b);
    };
    let max = 0;
    for (let i = 0; i < d.length; i += 4) max = Math.max(max, lum(d[i], d[i + 1], d[i + 2]));
    return max;
  }, "data:image/png;base64," + readFileSync(shot).toString("base64"));
  await probe.close();

  // --paper #EAE7DE, the colour the hero type is painted in.
  const paper = 0.2126 * 0.8069 + 0.7152 * 0.7835 + 0.0722 * 0.7305;
  return (Math.max(paper, lightest) + 0.05) / (Math.min(paper, lightest) + 0.05);
}

/* ------------------------------------------------------------- desktop */
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(BASE, { waitUntil: "networkidle" });

  check("burger hidden at 1440", !(await page.locator(".burger").isVisible()));
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

  /*
    Ten menu items in one bar is the tight case. A nav that overflows its wrap does not
    trigger a page-level scrollbar (the wrap clips it), so measure the bar itself.
  */
  const navFits = await page.evaluate(() => {
    const wrap = document.querySelector("nav.nav .wrap");
    return wrap.scrollWidth <= wrap.clientWidth + 1;
  });
  check("menu fits the bar at 1440", navFits);

  /*
    3:1 is the WCAG AA floor for large text, which the hero h1 is at every breakpoint.
    Measured against the lightest pixel behind it, so a bright sky in one photograph
    cannot pass on the strength of a dark one.
  */
  const homeC = await heroContrast(page, ".hero", ".hero h1");
  check("home hero text contrast >= 3:1", homeC >= 3, `${homeC.toFixed(2)}:1`);

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

  /*
    Tapping "Suburbs" now navigates rather than scrolling, so this also proves the drawer
    does not survive a real page change. The overflow check that follows runs on the
    destination, which is worth having: the standalone pages have their own hero and grid
    and could overflow independently of the home page.
  */
  await burger.click();
  await page.waitForTimeout(450);
  await page.locator("#site-menu a", { hasText: "FAQ" }).click();
  await page.waitForURL("**/adelaide-property-faq", { timeout: 10_000 });
  check("tapping a drawer link navigates", page.url().endsWith("/adelaide-property-faq"));
  // waitForURL resolves on the URL change, which beats the drawer's 400ms close.
  await page.waitForTimeout(700);
  check("drawer closed on the new page", !(await menuOpen(page)));

  const subW = await page.evaluate(() => document.documentElement.scrollWidth);
  check("no horizontal overflow, FAQ page (390)", subW <= 390, `scrollWidth ${subW}`);

  await page.goto(BASE, { waitUntil: "networkidle" });
  const docW = await page.evaluate(() => document.documentElement.scrollWidth);
  check("no horizontal overflow (390)", docW <= 390, `scrollWidth ${docW}`);

  await loadAllImages(page);
  await page.screenshot({ path: `${out}/mobile-full.png`, fullPage: true });
  await page.close();
}

/* ------------------------------------------------------- hero legibility */
/*
  Each standalone page has its own photograph behind the same overlay, so they are
  checked individually: one bright image is enough to make the heading unreadable while
  every other page passes.
*/
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  for (const path of [
    "/property-services",
    "/property-strategy-services",
    "/overseas-investment",
    "/free-property-appraisal-sa",
    "/about-adelaide-land-agent",
    "/contact",
    "/book-online",
    "/realestate-gift-adelaide",
    "/blog",
    "/adelaide-property-faq",
    "/for-sale",
    "/sold",
    "/free-suburb-insight-report",
    "/rent-property-house-adelaide",
    "/sell-property-house-adelaide",
    "/manage-property-adelaide",
  ]) {
    await page.goto(new URL(path, BASE).toString(), { waitUntil: "networkidle" });
    const c = await heroContrast(page, ".phero", ".phero h1");
    check(`hero contrast ${path}`, c !== null && c >= 3, c === null ? "no h1" : `${c.toFixed(2)}:1`);
  }
  await page.close();
}

/* ------------------------------------------------- links go somewhere */
/*
  The point of this block: every nav and footer item used to be an on-page anchor, so
  clicking one scrolled the home page instead of navigating. This asserts the opposite,
  and that each destination actually resolves - a nav full of 200s that render nothing
  is the failure mode a status check alone would miss.
*/
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(BASE, { waitUntil: "networkidle" });

  const links = await page.evaluate(() =>
    [...document.querySelectorAll("nav.nav a[href], footer.foot a[href], .sec-head a[href]")]
      .map((a) => a.getAttribute("href"))
      .filter((h) => h && !h.startsWith("tel:") && !h.startsWith("mailto:")),
  );
  const unique = [...new Set(links)];

  const anchors = unique.filter((h) => h.startsWith("#"));
  check("no on-page anchors in nav, footer or section heads", anchors.length === 0, anchors.join(" "));
  check("nav and footer carry real routes", unique.length >= 16, `${unique.length} distinct links`);

  /*
    The menu mirrors www.ozirealty.com.au item for item. Two slugs differ because the
    live spelling is wrong and both 301 from the original, which the redirect checks
    below cover.
  */
  // The whole header, not just #site-menu: "Free Appraisal" is the CTA button beside
  // the menu rather than an item inside it, and it still has to be there.
  const menu = await page.evaluate(() =>
    [...document.querySelectorAll("nav.nav a")].map((a) => a.getAttribute("href")),
  );
  const EXPECTED = [
    "/property-services",
    "/property-strategy-services",
    "/overseas-investment",
    "/free-property-appraisal-sa",
    "/about-adelaide-land-agent",
    "/contact",
    "/book-online",
    "/realestate-gift-adelaide",
    "/blog",
    "/adelaide-property-faq",
  ];
  for (const href of EXPECTED) {
    check(`menu carries ${href}`, menu.includes(href), menu.join(" "));
  }

  for (const href of unique) {
    const r = await page.request.get(new URL(href, BASE).toString());
    const body = await r.text();
    const ok = r.status() === 200 && /<h1[\s>]/.test(body);
    check(`${href}`, ok, `HTTP ${r.status()}${/<h1[\s>]/.test(body) ? "" : ", no h1"}`);
  }

  // The two misspelt legacy URLs must 301, not 404, and land on the corrected page.
  for (const [from, to] of [
    ["/oversees-investment", "/overseas-investment"],
    ["/contact-adelaide-realestae-agency", "/contact"],
  ]) {
    const r = await page.request.get(new URL(from, BASE).toString(), { maxRedirects: 0 });
    const loc = r.headers()["location"] ?? "";
    check(`${from} 301s to ${to}`, r.status() === 301 && loc.endsWith(to), `HTTP ${r.status()} -> ${loc || "none"}`);
  }

  await page.close();
}

await browser.close();
console.log(fails === 0 ? "\nAll checks passed." : `\n${fails} check(s) failed.`);
process.exit(fails === 0 ? 0 : 1);

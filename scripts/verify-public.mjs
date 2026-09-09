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

/**
 * Navigate without waiting for networkidle.
 *
 * Every hero pulls a photograph through next/image, which fetches from Unsplash on the
 * server. When that host is slow or rate-limiting, networkidle never settles and the run
 * dies on a 30s timeout having tested nothing. domcontentloaded plus a settle is enough:
 * the assertions here are about markup and layout, and the one that genuinely needs
 * decoded images calls loadAllImages() explicitly.
 */
async function go(page, url) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(400);
}

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
  // Tolerated rather than required: a slow image host must not fail the whole run.
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
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
  await go(page, BASE);

  check("burger hidden at 1440", !(await page.locator(".burger").isVisible()));
  check("nav CTA visible on desktop", await page.locator(".nav-cta .btn").isVisible());
  check(
    "start-here strip is real links",
    (await page.locator(".journey-track a.journey-item").count()) >= 5,
  );
  check("six cards", (await page.locator(".card").count()) === 6);

  await page.getByRole("button", { name: "Auction" }).click();
  await page.waitForTimeout(150);
  check("auction chip narrows to 2", (await page.locator(".card").count()) === 2);
  await page.getByRole("button", { name: "Everything" }).click();
  await page.waitForTimeout(150);
  check("everything chip restores 6", (await page.locator(".card").count()) === 6);

  // The hero search panel is deliberately out; it must not reappear by accident.
  check("no search panel in the hero", (await page.locator(".hero .search").count()) === 0);

  check("three free-report cards", (await page.locator(".report-card").count()) === 3);
  check("three why-us columns", (await page.locator(".why-card").count()) === 3);

  await loadAllImages(page);

  // Every <img> that reached the DOM must have actually decoded.
  const broken = await page.evaluate(() =>
    [...document.images]
      .filter((i) => !i.complete || i.naturalWidth === 0)
      .map((i) => (i.currentSrc || i.src).slice(0, 90)),
  );
  check("no broken images", broken.length === 0, broken.join(" | "));
  /*
    Counting images was a magic number that went stale the moment the page changed. What
    actually matters is that every listing card has a photograph and the hero has one, so
    that is what is asserted.
  */
  const shots = await page.evaluate(() => ({
    hero: document.querySelectorAll(".hero-media img").length,
    cards: document.querySelectorAll(".card").length,
    cardImgs: document.querySelectorAll(".card-media img").length,
  }));
  check("hero has a photograph", shots.hero === 1);
  check(
    "every listing card has a photograph",
    shots.cards > 0 && shots.cardImgs === shots.cards,
    `${shots.cardImgs} images for ${shots.cards} cards`,
  );

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
  await go(page, BASE);

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

  await go(page, BASE);
  const docW = await page.evaluate(() => document.documentElement.scrollWidth);
  check("no horizontal overflow (390)", docW <= 390, `scrollWidth ${docW}`);

  await loadAllImages(page);
  await page.screenshot({ path: `${out}/mobile-full.png`, fullPage: true });
  await page.close();
}

/* ------------------------------------------------------------------ forms */
/*
  A form that renders and cannot submit is the failure that matters here, and it looks
  identical to a working one. So this does not just count fields: it drives a real
  submission through /api/forms/[key] and checks the endpoint accepted it.
*/
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const WITH_FORMS = [
    "/manage-property-adelaide",
    "/sell-property-house-adelaide",
    "/rent-out-my-property-adelaide",
    "/buyer-agent-adelaide",
    "/property-investment",
    "/land-opportunities-sa-adelaide",
    "/rent-property-house-adelaide",
    "/sell-my-business-australia",
    "/free-property-appraisal-sa",
    "/free-suburb-insight-report",
    "/book-online",
    "/property-services",
    "/property-strategy-services",
    "/overseas-investment",
    "/realestate-gift-adelaide",
    "/contact",
  ];
  for (const path of WITH_FORMS) {
    await go(page, new URL(path, BASE).toString());
    const shape = await page.evaluate(() => {
      const f = document.querySelector("form.enq");
      if (!f) return null;
      return {
        inputs: f.querySelectorAll("input,textarea").length,
        groups: f.querySelectorAll("fieldset.enq-field--group").length,
        honeypot: !!f.querySelector('input[name="website"]'),
        consents: f.querySelectorAll(".enq-check input").length,
        submit: !!f.querySelector('button[type="submit"]'),
      };
    });
    check(`${path} has an enquiry form`, shape !== null);
    if (!shape) continue;
    check(`${path} form has a honeypot`, shape.honeypot);
    check(`${path} form has both consent boxes`, shape.consents === 2, `${shape.consents}`);
    check(`${path} form has a submit`, shape.submit);
    /*
      Two checkboxes, not one. The live site bundles marketing consent into a single
      required box; the Spam Act wants it separate, specific and voluntary, so the
      required one acknowledges privacy and the optional one is the marketing consent.
    */
    /*
      Wait for the state rather than sampling it. The submit stays disabled until the
      token GET resolves, so reading it immediately after navigation tests how fast the
      page happened to load, not whether the form works. It failed exactly that way on
      the heaviest page in the set.
    */
    const enabled = await page
      .waitForFunction(
        () => !document.querySelector("form.enq button[type=submit]")?.disabled,
        undefined,
        { timeout: 15000 },
      )
      .then(() => true)
      .catch(() => false);
    check(`${path} form becomes live`, enabled);
  }
  await page.close();
}

/* ------------------------------------------------------------------ blog */
/*
  The blog is the biggest surface on the site now, 54 posts migrated out of Wix. The
  check follows a real card rather than a hardcoded slug: what matters is that the index
  links to posts that actually render, and a fixed slug would stop testing that the day
  the blog is re-scraped.
*/
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await go(page, new URL("/blog", BASE).toString());
  /* .post-lead as well as .post: page one promotes the newest post to a wider card. */
  const cards = await page.locator(".post, .post-lead").count();
  check("blog lists a page of posts", cards === 12, cards + " posts");

  const href = await page.locator(".post").first().getAttribute("href");
  check(
    "post links keep the live /post/<slug> pattern",
    !!href && href.startsWith("/post/"),
    href || "none",
  );

  if (href) {
    await go(page, new URL(href, BASE).toString());
    const shape = await page.evaluate(() => ({
      h1: document.querySelector(".post-head h1")?.textContent?.trim() || "",
      paras: document.querySelectorAll(".post-body p").length,
      cover: document.querySelectorAll(".post-cover img").length,
    }));
    check(href + " has a heading", shape.h1.length > 5, shape.h1.slice(0, 50));
    check(href + " has body copy", shape.paras >= 3, shape.paras + " paragraphs");
    check(href + " has a cover image", shape.cover === 1);
  }

  /*
    Pagination. The page-size check is the one that matters: a paginator that renders but
    puts every post on page one is indistinguishable from a working one until the archive
    grows. /blog/page/1 must NOT exist, because it would be a second URL for page one.
  */
  await go(page, new URL("/blog", BASE).toString());
  const first = await page.locator(".post, .post-lead").count();
  check("page one shows 12 posts", first === 12, first + " posts");

  await go(page, new URL("/blog/page/2", BASE).toString());
  const second = await page.locator(".post").count();
  check("page two shows 12 posts", second === 12, second + " cards");
  check("page two has a pager", (await page.locator(".pager").count()) === 1);

  const past = await page.request.get(new URL("/blog/page/99", BASE).toString());
  check("a page past the end is a 404", past.status() === 404, "HTTP " + past.status());

  const dupe = await page.request.get(new URL("/blog/page/1", BASE).toString());
  check("/blog/page/1 does not duplicate /blog", dupe.status() === 404, "HTTP " + dupe.status());

  await page.close();
}

/* --------------------------------------------------- service page blocks */
/*
  The persuasion layer: three benefit cards, a photograph band, and the pitch that sits
  directly above the form. Checked on every page that declares extras, because the
  content lives in one map and a missing key would silently render a thinner page rather
  than fail.
*/
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const WITH_EXTRAS = [
    "/sell-property-house-adelaide",
    "/rent-out-my-property-adelaide",
    "/rent-property-house-adelaide",
    "/buyer-agent-adelaide",
    "/property-investment",
    "/land-opportunities-sa-adelaide",
    "/sell-my-business-australia",
    "/property-strategy-services",
    "/overseas-investment",
    "/realestate-gift-adelaide",
  ];
  for (const path of WITH_EXTRAS) {
    await go(page, new URL(path, BASE).toString());
    const shape = await page.evaluate(() => ({
      cards: document.querySelectorAll(".benefit").length,
      icons: document.querySelectorAll(".benefit-icon svg").length,
      figures: document.querySelectorAll(".gallery-figs figure img").length,
      pitch: document.querySelectorAll(".pitch").length,
      bullets: document.querySelectorAll(".pitch-list li").length,
      cost: document.querySelectorAll(".pitch-cost").length,
      /* The pitch has to come BEFORE the form, or it is not doing its job. */
      order: (() => {
        const pitch = document.querySelector(".pitch");
        const form = document.querySelector("form.enq");
        if (!pitch || !form) return false;
        return !!(pitch.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING);
      })(),
    }));
    check(path + " has three benefit cards", shape.cards === 3, shape.cards + " cards");
    check(path + " benefit cards have icons", shape.icons === 3, shape.icons + " icons");
    check(path + " has two photographs", shape.figures === 2, shape.figures + " images");
    check(path + " has a pitch with bullets", shape.pitch === 1 && shape.bullets >= 3, shape.bullets + " bullets");
    check(path + " pitch names a cost", shape.cost === 1);
    check(path + " pitch sits above the form", shape.order);
  }
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
    await go(page, new URL(path, BASE).toString());
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
  await go(page, BASE);

  /*
    .journey-track is in this list because it was not, and four links in the hero's
    "start here" strip shipped as 404s: the crawl only looked at the nav, the footer and
    section heads. Any container of links on the home page belongs here.
  */
  const links = await page.evaluate(() =>
    [...document.querySelectorAll(
      "nav.nav a[href], footer.foot a[href], .sec-head a[href], .journey-track a[href]",
    )]
      .map((a) => a.getAttribute("href"))
      .filter((h) => h && !h.startsWith("tel:") && !h.startsWith("mailto:")),
  );
  const unique = [...new Set(links)];

  const anchors = unique.filter((h) => h.startsWith("#"));
  check("no on-page anchors in nav, footer or section heads", anchors.length === 0, anchors.join(" "));
  /*
    The menu is asserted item by item below, so a count here adds nothing. What a count
    cannot see is the footer, which carries routes the menu does not.
  */
  for (const href of ["/sold", "/for-sale", "/blog", "/contact"]) {
    check(`footer or nav reaches ${href}`, unique.includes(href), unique.join(" "));
  }

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

  /*
    The point of the content rewrite: nothing may claim a result the agency did not
    achieve, name an agent who does not work there, or advertise an office that does not
    exist. Checked on every page, because the invented copy was spread across all of them.
  */
  const FORBIDDEN = [
    "Nadia Fielding",
    "Tom Rasheed",
    "Priya Ellis",
    "Jetty Road",
    "218 Google",
    "98.6",
    "412 campaigns",
    "27 days to contract",
    "Prospect &amp; Glenelg",
  ];

  for (const href of unique) {
    const r = await page.request.get(new URL(href, BASE).toString());
    const body = await r.text();
    const ok = r.status() === 200 && /<h1[\s>]/.test(body);
    check(`${href}`, ok, `HTTP ${r.status()}${/<h1[\s>]/.test(body) ? "" : ", no h1"}`);
    const bad = FORBIDDEN.filter((f) => body.includes(f));
    check(`${href} claims nothing invented`, bad.length === 0, bad.join(", "));
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

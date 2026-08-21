import { chromium } from "playwright";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
for (const route of ["/dashboard/", "/confirm/", "/approvals/", "/matching/"]) {
  await p.goto("http://localhost:3210" + route, { waitUntil: "networkidle" });
  const t = await p.evaluate(() => {
    const out = {};
    for (const el of document.querySelectorAll("a,button,input,[role=button]")) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && (r.height < 30 || r.width < 30)) {
        // Inline links inside running text are exempt from target-size rules
        // (WCAG 2.5.8). Standalone controls are not.
        const d = getComputedStyle(el).display;
        const inline = el.tagName === "A" && (d === "inline" || d === "inline-block");
        const k = (inline ? "inline-link" : "CONTROL   ") + " " +
                  el.tagName.toLowerCase() + " h=" + Math.round(r.height) +
                  " w=" + Math.round(r.width);
        out[k] = (out[k] || 0) + 1;
      }
    }
    return out;
  });
  console.log("\n" + route);
  for (const [k, v] of Object.entries(t)) console.log("   " + v + "x  " + k);
}
await b.close();

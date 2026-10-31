"use client";

import { useEffect } from "react";

/**
 * Drives the services page's "I am…" buttons. The cards are server-rendered with a
 * space-separated `data-aud`; this only flips `hidden` on them and `aria-pressed` on the
 * buttons, then scrolls to the grid.
 */
export function AudiencePicker() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const b = (e.target as Element).closest<HTMLButtonElement>(".ps-who [data-aud]");
      if (!b) return;
      const a = b.dataset.aud ?? "";
      document.querySelectorAll<HTMLElement>(".ps-who [data-aud]").forEach((x) => {
        x.setAttribute("aria-pressed", String(x === b));
      });
      document.querySelectorAll<HTMLElement>(".ps-card[data-aud]").forEach((c) => {
        c.hidden = a !== "" && !(c.dataset.aud ?? "").split(" ").includes(a);
      });
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.getElementById("ps-services")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}

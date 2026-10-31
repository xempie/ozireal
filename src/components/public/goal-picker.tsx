"use client";

import { useEffect } from "react";

/**
 * Drives the Strategy Services goal picker. The panels are server-rendered (each holds a
 * real enquiry form); this only flips `hidden` on `[data-panel]` and `aria-pressed` on
 * `[data-goal]` buttons, and scrolls to `#pick` when a goal is chosen further down the page.
 */
export function GoalPicker() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const t = (e.target as Element).closest<HTMLElement>("[data-goal]");
      if (!t) return;
      e.preventDefault();
      const k = t.dataset.goal;
      document.querySelectorAll<HTMLElement>("[data-panel]").forEach((p) => {
        p.hidden = p.dataset.panel !== k;
      });
      document.querySelectorAll<HTMLElement>(".goal[data-goal]").forEach((g) => {
        g.setAttribute("aria-pressed", String(g.dataset.goal === k));
      });
      const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.getElementById("pick")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}

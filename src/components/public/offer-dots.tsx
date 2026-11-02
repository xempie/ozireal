"use client";

import { useEffect, useState } from "react";

/**
 * Position dots for the home page's free-offer swipe row on phones (2026-11-02). Hidden
 * by CSS above phone width, where the cards sit in a grid. Tapping a dot scrolls that
 * card into the centre.
 */
export function OfferDots({ count, trackId }: { count: number; trackId: string }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const track = document.getElementById(trackId);
    if (!track) return;
    const sync = () => {
      const mid = track.scrollLeft + track.clientWidth / 2;
      let best = 0;
      let dist = Infinity;
      Array.from(track.children).forEach((c, i) => {
        const el = c as HTMLElement;
        const d = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid);
        if (d < dist) {
          dist = d;
          best = i;
        }
      });
      setActive(best);
    };
    track.addEventListener("scroll", sync, { passive: true });
    return () => track.removeEventListener("scroll", sync);
  }, [trackId]);

  const go = (i: number) => {
    const card = document.getElementById(trackId)?.children[i] as HTMLElement | undefined;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    card?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", inline: "center", block: "nearest" });
  };

  return (
    <div className="of-dots" aria-label="Free reports">
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          aria-label={`Show report ${i + 1}`}
          aria-current={i === active ? "true" : undefined}
          onClick={() => go(i)}
        />
      ))}
    </div>
  );
}

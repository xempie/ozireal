"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Phone-only call bar plus a back-to-top arrow on every public page (owner's request,
 * 2026-10-31).
 *
 * The bar always offers a call to the principal's mobile. Its second button is the page's
 * own main action when the page declares one (the hidden `.ss-sticky` link the service
 * pages render), otherwise the free appraisal. The arrow appears after the reader has
 * scrolled a screen or so, on every screen size.
 */

const FALLBACK = { href: "/free-property-appraisal-sa", label: "Free appraisal" };

export function MobileDock({ mobile, mobileHref }: { mobile: string; mobileHref: string }) {
  const pathname = usePathname();
  const [cta, setCta] = useState(FALLBACK);
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const a = document.querySelector<HTMLAnchorElement>(".ss-sticky a.btn");
    const label = a?.textContent?.trim();
    setCta(a && label ? { href: a.getAttribute("href") ?? FALLBACK.href, label } : FALLBACK);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 700);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const toTop = () => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <>
      <button
        type="button"
        className={showTop ? "to-top is-on" : "to-top"}
        onClick={toTop}
        aria-label="Back to top"
        tabIndex={showTop ? 0 : -1}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className="m-dock" role="region" aria-label="Quick contact">
        <a className="m-dock-call" href={mobileHref} aria-label={`Call Esi on ${mobile}`}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path
              d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"
              fill="currentColor"
            />
          </svg>
          <span>
            Call Esi <small>{mobile}</small>
          </span>
        </a>
        <a className="m-dock-cta" href={cta.href}>
          {cta.label}
        </a>
      </div>
    </>
  );
}

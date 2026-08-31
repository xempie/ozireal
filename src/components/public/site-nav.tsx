"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

/**
 * The public navigation.
 *
 * The only client component on the public site, and it earns it twice: the mobile
 * drawer and the scrolled state both need to know something the server cannot.
 * Everything else — hero, cards, footer, the services accordion — stays server-rendered.
 *
 * Two details carried over from the template, and one bug in it that is not:
 *
 *   - `.stuck` returns. The nav has no separator at rest, and gains a hairline and a
 *     soft shadow once the page has scrolled. That is what the horizontal line under
 *     the header was: converting this to a server component lost the scroll state, so
 *     the border became permanent and sat there against the hero.
 *
 *   - The closed drawer draws nothing. The template's mobile menu is `max-height: 0`
 *     with `overflow: hidden` AND a `border-bottom` — and a border is not clipped by
 *     overflow, so a closed menu paints a 1px line across the viewport. The border
 *     lives on the menu's items here instead, so a closed drawer is genuinely invisible.
 */

/**
 * On-page anchors, not routes — deliberately, and temporarily.
 *
 * The real destinations are /for-sale, /for-rent, /appraisal,
 * /services/property-management, /suburbs and /journal. None of those routes exist yet,
 * and a nav in which every item 404s is a worse demo than one that scrolls. These revert
 * to real hrefs as each route lands; the template used the same anchors for the same
 * reason.
 */
const NAV = [
  { href: "#listings", label: "Buy" },
  { href: "#listings", label: "Rent" },
  { href: "#appraise", label: "Sell" },
  { href: "#services", label: "Manage" },
  { href: "#suburbs", label: "Suburbs" },
  { href: "#journal", label: "Journal" },
] as const;

export function SiteNav({ logo, agencyName }: { logo: string; agencyName: string }) {
  const [open, setOpen] = React.useState(false);
  const [stuck, setStuck] = React.useState(false);
  const pathname = usePathname();

  /** Navigating from inside the drawer should leave it closed on the new page. */
  React.useEffect(() => setOpen(false), [pathname]);

  React.useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 20);
    onScroll();
    // Passive: this listener never calls preventDefault, and saying so keeps it off
    // the critical path of a scroll on a phone.
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /** Escape closes it, and the page behind must not scroll while it is open. */
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <nav className={`nav${stuck ? " stuck" : ""}${open ? " open" : ""}`}>
      <div className="wrap">
        <Link className="brand" href="/" aria-label={`${agencyName} home`}>
          <Image
            src={logo}
            alt={agencyName}
            width={227}
            height={35}
            priority
            style={{ height: 30, width: "auto" }}
          />
        </Link>

        <div className="menu" id="site-menu">
          {NAV.map((n, i) => (
            <Link
              key={n.label}
              href={n.href}
              /*
                Closing on click rather than only on a pathname change: while NAV holds
                on-page anchors the pathname never changes, so the effect above would
                leave the drawer covering the section it just scrolled to.
              */
              onClick={() => setOpen(false)}
              aria-current={
                n.href.startsWith("#")
                  ? pathname === "/" && i === 0
                    ? "page"
                    : undefined
                  : pathname === n.href || pathname.startsWith(n.href + "/")
                    ? "page"
                    : undefined
              }
            >
              {n.label}
            </Link>
          ))}
          {/*
            The appraisal CTA is a button in the bar on desktop, where it is the most
            valuable link on the site. In the drawer it becomes the last item rather
            than disappearing — the template hid it on mobile, which removes the primary
            call to action from exactly the device most people arrive on.
          */}
          <Link href="#appraise" className="menu-cta" onClick={() => setOpen(false)}>
            Free appraisal
          </Link>
        </div>

        <div className="nav-cta">
          <Link className="btn" href="#appraise">
            Free appraisal
          </Link>
          <button
            className="burger"
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="site-menu"
            onClick={() => setOpen((o) => !o)}
          >
            <i />
            <i />
            <i />
          </button>
        </div>
      </div>
    </nav>
  );
}

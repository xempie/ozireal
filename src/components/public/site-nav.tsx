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
 * The site menu, mirroring www.ozirealty.com.au item for item.
 *
 * Read off the live site's rendered nav rather than guessed from the sitemap: the
 * sitemap lists 22 pages, only these eleven are in the menu, and the labels are the
 * agency's own wording ("Oversea Investment", "Gift Party", "Free Meeting").
 *
 * Two slugs differ from the live site because the live spelling is wrong, and both 301
 * from the original in next.config.ts:
 *
 *   Oversea Investment  /oversees-investment               -> /overseas-investment
 *   Contact Us          /contact-adelaide-realestae-agency -> /contact
 *
 * "Free Appraisal" is in the live menu and is not in this list, because it is the CTA
 * button beside it. Listing it in both rendered the same words twice in one bar. The
 * drawer appends it as its own item, so on a phone it still appears exactly once.
 *
 * Nine items do not fit one bar on a laptop, so the drawer takes over at 1240px rather
 * than the 900px a six-item menu needed. Nothing is ever hidden without the burger
 * appearing to reach it, which is the trap the alternative had.
 */
type NavItem = { href: string; label: string; children?: { href: string; label: string }[] };

/*
 * Since 2026-10-29 (owner's request) Gift Party, FAQ and the privacy policy sit under
 * "About Us": a hover/focus dropdown on desktop, an indented list in the drawer.
 */
const NAV: NavItem[] = [
  {
    // The eight services, same names and pages as the homepage grid, plus Strategy
    // Services, which had its own top-level item until 2026-10-29.
    href: "/property-services",
    label: "Services",
    children: [
      { href: "/sell-property-house-adelaide", label: "Sell My Property" },
      { href: "/manage-property-adelaide", label: "Manage My Property" },
      { href: "/rent-out-my-property-adelaide", label: "Rent Out My Property" },
      { href: "/buyer-agent-adelaide", label: "I Need A Buyer Agent" },
      { href: "/property-investment", label: "I Want to Invest" },
      { href: "/land-opportunities-sa-adelaide", label: "Looking For Land" },
      { href: "/rent-property-house-adelaide", label: "I Need To Rent" },
      { href: "/sell-my-business-australia", label: "Sell My Business" },
      { href: "/property-strategy-services", label: "Strategy Services" },
    ],
  },
  {
    href: "/projects-and-opportunities",
    label: "Opportunities",
    children: [{ href: "/projects-and-opportunities", label: "Projects & Opportunities" }],
  },
  { href: "/overseas-investment", label: "Oversea Investment" },
  {
    href: "/about-adelaide-land-agent",
    label: "About Us",
    children: [
      { href: "/realestate-gift-adelaide", label: "Gift Party" },
      { href: "/adelaide-property-faq", label: "FAQ" },
      { href: "/privacy", label: "Privacy Policy" },
    ],
  },
  { href: "/contact", label: "Contact" },
  { href: "/book-online", label: "Free Meeting" },
  { href: "/blog", label: "Blog" },
];

const isCurrent = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(href + "/") ? ("page" as const) : undefined;

export function SiteNav({ logo, agencyName }: { logo: string; agencyName: string }) {
  const [open, setOpen] = React.useState(false);
  const [stuck, setStuck] = React.useState(false);
  const pathname = usePathname();

  /** Navigating from inside the drawer should leave it closed on the new page. */
  React.useEffect(() => setOpen(false), [pathname]);

  /** Which dropdown is expanded in the phone drawer (desktop opens them on hover). */
  const [expanded, setExpanded] = React.useState<string | null>(null);
  React.useEffect(() => setExpanded(null), [pathname, open]);

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
          {NAV.map((n) => {
            const link = (
              <Link
                key={n.label}
                href={n.href}
                /*
                  Kept alongside the pathname effect above: clicking the item you are
                  already on does not change the pathname, so the effect would not fire
                  and the drawer would stay open over the page.
                */
                onClick={() => setOpen(false)}
                aria-current={isCurrent(pathname, n.href)}
              >
                {n.label}
                {n.children && <span className="menu-caret" aria-hidden="true" />}
              </Link>
            );
            if (!n.children) return link;
            return (
              <div className={`menu-group${expanded === n.label ? " is-open" : ""}`} key={n.label}>
                {link}
                {/* Phone drawer only: opens this group's list in place. Hidden on desktop. */}
                <button
                  type="button"
                  className="submenu-toggle"
                  aria-expanded={expanded === n.label}
                  aria-label={`${expanded === n.label ? "Hide" : "Show"} ${n.label} pages`}
                  onClick={() => setExpanded((e) => (e === n.label ? null : n.label))}
                />
                <div className="submenu">
                  {n.children.map((c) => (
                    <Link
                      key={c.href}
                      href={c.href}
                      onClick={() => setOpen(false)}
                      aria-current={isCurrent(pathname, c.href)}
                    >
                      {c.label}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
          {/*
            The appraisal CTA is a button in the bar on desktop, where it is the most
            valuable link on the site. In the drawer it becomes the last item rather
            than disappearing — the template hid it on mobile, which removes the primary
            call to action from exactly the device most people arrive on.
          */}
          <Link href="/free-property-appraisal-sa" className="menu-cta" onClick={() => setOpen(false)}>
            Free appraisal
          </Link>
        </div>

        <div className="nav-cta">
          <Link className="btn" href="/free-property-appraisal-sa">
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

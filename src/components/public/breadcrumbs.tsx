"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Breadcrumbs for every public page except the home page, with matching
 * schema.org BreadcrumbList markup. A client component only because the shared layout
 * cannot otherwise see the path; it still renders on the server, so crawlers get it.
 */

const LABELS: Record<string, string> = {
  "for-sale": "For sale",
  sold: "Sold and leased",
  suburbs: "Suburbs",
  "property-services": "Services",
  "property-strategy-services": "Strategy services",
  "overseas-investment": "Overseas investment",
  "free-property-appraisal-sa": "Free appraisal",
  "free-suburb-insight-report": "Suburb insight report",
  "property-rental-report": "Rental report",
  "about-adelaide-land-agent": "About",
  contact: "Contact",
  "book-online": "Free meeting",
  "realestate-gift-adelaide": "Gift party",
  blog: "Blog",
  post: "Blog",
  "adelaide-property-faq": "FAQ",
  "manage-property-adelaide": "Property management",
  "sell-property-house-adelaide": "Sell my property",
  "rent-out-my-property-adelaide": "Rent out my property",
  "rent-property-house-adelaide": "Rent a property",
  "buyer-agent-adelaide": "Buyer agent",
  "property-investment": "Property investment",
  "land-opportunities-sa-adelaide": "Land opportunities",
  "sell-my-business-australia": "Sell my business",
  privacy: "Privacy policy",
  terms: "Terms of use",
  complaints: "Complaints",
};

/** Where a parent segment with no page of its own should point. */
const PARENT_HREF: Record<string, string> = { post: "/blog" };

const humanise = (seg: string) => {
  const s = decodeURIComponent(seg).replace(/-/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export function Breadcrumbs({ siteUrl }: { siteUrl: string }) {
  const path = usePathname() ?? "/";
  const segs = path.split("/").filter(Boolean);
  if (segs.length === 0) return null;

  const crumbs = [{ label: "Home", href: "/" }];
  segs.forEach((seg, i) => {
    const href = PARENT_HREF[seg] ?? "/" + segs.slice(0, i + 1).join("/");
    // A blog post's title is long and already the h1; the trail stops at "Blog".
    if (i > 0 && segs[0] === "post") return;
    crumbs.push({ label: LABELS[seg] ?? humanise(seg), href });
  });

  const ld = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.label,
      item: siteUrl + c.href,
    })),
  };

  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      <div className="wrap">
        <ol>
          {crumbs.map((c, i) => (
            <li key={c.href + i}>
              {i === crumbs.length - 1 ? (
                <span aria-current="page">{c.label}</span>
              ) : (
                <Link href={c.href}>{c.label}</Link>
              )}
            </li>
          ))}
        </ol>
      </div>
      <script
        type="application/ld+json"
        // Built from the path and a fixed label map; JSON.stringify escapes it.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }}
      />
    </nav>
  );
}

import type { Metadata } from "next";
import { Newsreader, Instrument_Sans } from "next/font/google";
import "./public.css";
import { SiteHeader, SiteFooter, AGENCY } from "@/components/public/site-chrome";
import { Breadcrumbs } from "@/components/public/breadcrumbs";
import { MobileDock } from "@/components/public/mobile-dock";
import { Zone } from "@/components/public/blocks";
import { currentPath, currentPageContent, isPreview, themeContent } from "@/server/public/content";
import { isBuiltinPath, themeCss } from "@/lib/site-content";

/**
 * The public website.
 *
 * A sibling route group to `(app)`, sharing one Next app and one database — §2 forbids a
 * parallel API surface, and a separate front end would need one the moment it wanted to
 * read a listing. What separates them is the read path, not the deployment: nothing here
 * may import `@/db` or `@/server/queries`; everything goes through `src/server/public/*`,
 * and `tests/public-boundary.test.ts` fails the build if that stops being true.
 *
 * Note what this layout does NOT inherit. `(app)/layout.tsx` sets `force-dynamic` so the
 * console never renders stale data; a sibling group does not inherit that, so these pages
 * are static by default — which is what a marketing site wants, and what makes ISR in
 * Stage 2 possible.
 */

/**
 * Self-hosted through next/font rather than a stylesheet link: a render-blocking request
 * to fonts.googleapis.com on every public page is the single easiest Core Web Vitals
 * regression to ship, and `display: swap` keeps text visible while they load.
 */
const display = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-display",
});

const body = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-body",
});

/*
 * There used to be a third face here, IBM Plex Mono, for every eyebrow, label, button,
 * price and stat. Since 2026-10-29 those use the body face at semibold (owner's
 * choice); public.css points --mono at --font-body, so the token name survives.
 */

export const metadata: Metadata = {
  title: {
    default: "Ozi Realty Adelaide | Real Estate Sales, Property Management & Rentals",
    template: "%s · Ozi Realty",
  },
  description:
    "Adelaide real estate agency in Prospect. Homes for sale and rent, free property appraisals, and property management from 2.99%.",
  openGraph: {
    type: "website",
    siteName: AGENCY.name,
    locale: "en_AU",
  },
  // The console sets robots:{index:false}; the public site must say the opposite
  // explicitly rather than relying on the absence of a rule.
  robots: { index: true, follow: true },
};

/**
 * schema.org RealEstateAgent on every public page, from the same AGENCY constants the
 * footer prints, so the markup can never claim anything the page does not.
 */
function agencyJsonLd() {
  const url = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.ozirealty.com.au";
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: AGENCY.name,
    url,
    logo: `${url}/brand/logo.png`,
    image: `${url}/brand/logo.png`,
    telephone: AGENCY.phone,
    email: AGENCY.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: AGENCY.street,
      addressLocality: AGENCY.locality,
      addressRegion: AGENCY.region,
      postalCode: AGENCY.postcode,
      addressCountry: "AU",
    },
    founder: { "@type": "Person", name: AGENCY.principal },
    areaServed: AGENCY.areaServed,
  };
}

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Website editor: theme colours and fonts, blocks added at the end of a built-in
  // page, and a bar that makes a preview impossible to mistake for the live site.
  const [path, doc, theme, preview] = await Promise.all([
    currentPath(),
    currentPageContent(),
    themeContent(),
    isPreview(),
  ]);
  const css = themeCss(theme);

  return (
    /**
     * `.site` scopes the whole theme. The root layout stamps `data-theme` on <html>
     * before paint for the console's dark mode; scoping here means that stamp has
     * nothing to act on, so the public site stays light without having to fight it.
     */
    <div
      className={`site ${display.variable} ${body.variable}`}
      style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}
    >
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      {preview && (
        <div className="preview-bar" role="status">
          Preview: you are seeing unpublished changes.{" "}
          <a href={`/api/website/preview/exit?path=${encodeURIComponent(path)}`}>Exit preview</a>
        </div>
      )}
      <SiteHeader />
      <Breadcrumbs siteUrl={process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.ozirealty.com.au"} />
      <main id="main">
        {children}
        {isBuiltinPath(path) && <Zone blocks={doc?.blocks} zone="end" />}
      </main>
      <script
        type="application/ld+json"
        // Our own constants, not user input; JSON.stringify output is safe here.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(agencyJsonLd()) }}
      />
      <SiteFooter />
      <MobileDock mobile={AGENCY.mobile} mobileHref={AGENCY.mobileHref} />
    </div>
  );
}

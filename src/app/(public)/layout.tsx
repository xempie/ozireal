import type { Metadata } from "next";
import { Newsreader, Instrument_Sans, IBM_Plex_Mono } from "next/font/google";
import "./public.css";
import { SiteHeader, SiteFooter, AGENCY } from "@/components/public/site-chrome";

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

/**
 * The template's third face, and the one that carries its voice: every eyebrow, label,
 * button, price and stat is mono. It is doing structural work rather than decoration,
 * so it is a real font rather than a fallback stack.
 */
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: {
    default: "Ozi Realty — Adelaide real estate, sales, rentals and management",
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

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    /**
     * `.site` scopes the whole theme. The root layout stamps `data-theme` on <html>
     * before paint for the console's dark mode; scoping here means that stamp has
     * nothing to act on, so the public site stays light without having to fight it.
     */
    <div
      className={`site ${display.variable} ${body.variable} ${mono.variable}`}
      style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}
    >
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
    </div>
  );
}

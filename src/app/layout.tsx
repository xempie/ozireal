import type { Metadata } from "next";
import "./globals.css";

/**
 * The root layout is shared by the console and the public website, so it carries
 * nothing that belongs to either.
 *
 * It used to export console-branded metadata ("Ozi Realty — Console", "Prototype with
 * sample data"). Route groups do not create metadata boundaries, so every public page
 * would have inherited that title and told Google the agency's website was an internal
 * prototype. The console's own metadata now lives in `(app)/layout.tsx`, and each public
 * route sets its own.
 */
export const metadata: Metadata = {
  /**
   * Load-bearing for SEO: without it, a relative canonical or OG image URL cannot be
   * resolved and Next silently drops it. Falls back to the production host so a build
   * with no env var still emits absolute URLs rather than none.
   */
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.ozirealty.com.au",
  ),
};

/**
 * Applies the stored theme before first paint so a dark-mode user never sees a
 * white flash. Runs before React hydrates, hence the raw script tag.
 *
 * It only ever stamps the CONSOLE's theme. The public site is deliberately light-only
 * (its own decision, see `(public)/layout.tsx`), and it neutralises the stamp for its
 * own subtree rather than fighting it here — this script has to run before paint for
 * every route, and branching on the pathname inside it would be one more thing to get
 * wrong on a route that does not exist yet.
 */
const themeScript = `
(function () {
  try {
    var t = localStorage.getItem('ozi-theme');
    if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', t);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-AU" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

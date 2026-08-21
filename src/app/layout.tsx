import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ozi Realty — Console",
  description: "Internal CRM and operations console. Prototype with sample data.",
};

/**
 * Applies the stored theme before first paint so a dark-mode user never sees a
 * white flash. Runs before React hydrates, hence the raw script tag.
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

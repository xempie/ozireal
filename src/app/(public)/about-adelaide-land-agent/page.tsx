import type { Metadata } from "next";
import { ServicePageBody } from "@/components/public/page-shell";
import { servicePageBySlug } from "@/components/public/site-pages";

/**
 * Slug mirrors the live Wix page. "About" in the site menu.
 */

const page = servicePageBySlug("about-adelaide-land-agent")!;

export const metadata: Metadata = {
  title: page.metaTitle,
  description: page.metaDescription,
  alternates: { canonical: "/about-adelaide-land-agent" },
};

export default function Page() {
  return <ServicePageBody page={page} />;
}

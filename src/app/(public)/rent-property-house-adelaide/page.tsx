import type { Metadata } from "next";
import { ServicePageBody } from "@/components/public/page-shell";
import { servicePageBySlug } from "@/components/public/site-pages";

/**
 * Slug mirrors the live Wix page. This is the tenant side of renting; the landlord
 * side lives at /manage-property-adelaide.
 */

const page = servicePageBySlug("rent-property-house-adelaide")!;

export const metadata: Metadata = {
  title: page.metaTitle,
  description: page.metaDescription,
  alternates: { canonical: "/rent-property-house-adelaide" },
};

export default function Page() {
  return <ServicePageBody page={page} />;
}

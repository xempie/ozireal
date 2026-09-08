import type { Metadata } from "next";
import { ServicePageBody } from "@/components/public/page-shell";
import { servicePageBySlug } from "@/components/public/site-pages";

/**
 * Slug mirrors the live Wix page. Note that /rent-out-my-property-adelaide and
 * /property-rental-report also market management on the current site; both should 301 here
 * unless they are rebuilt separately.
 */

const page = servicePageBySlug("manage-property-adelaide")!;

export const metadata: Metadata = {
  title: page.metaTitle,
  description: page.metaDescription,
  alternates: { canonical: "/manage-property-adelaide" },
};

export default function Page() {
  return <ServicePageBody page={page} />;
}

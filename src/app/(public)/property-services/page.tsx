import type { Metadata } from "next";
import { ServicePageBody } from "@/components/public/page-shell";
import { servicePageBySlug } from "@/components/public/site-pages";

/**
 * Slug mirrors the live Wix page. The overview that the four service pages hang off.
 */

const page = servicePageBySlug("property-services")!;

export const metadata: Metadata = {
  title: page.metaTitle,
  description: page.metaDescription,
  alternates: { canonical: "/property-services" },
};

export default function Page() {
  return <ServicePageBody page={page} />;
}

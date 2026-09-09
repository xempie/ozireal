import type { Metadata } from "next";
import { ServicePageBody } from "@/components/public/page-shell";
import { FormSection } from "@/components/public/forms/form-section";
import { servicePageBySlug } from "@/components/public/site-pages";

/**
 * Slug mirrors the live Wix page, "I Want to Invest" in the services row.
 */

const page = servicePageBySlug("property-investment")!;

export const metadata: Metadata = {
  title: page.metaTitle,
  description: page.metaDescription,
  alternates: { canonical: "/property-investment" },
};

export default function Page() {
  return (
    <>
      <ServicePageBody page={page} />
      <FormSection slug="property-investment" />
    </>
  );
}

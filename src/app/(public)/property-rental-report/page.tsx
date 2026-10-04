import type { Metadata } from "next";
import { ServicePageBody } from "@/components/public/page-shell";
import { FormSection } from "@/components/public/forms/form-section";
import { servicePageBySlug } from "@/components/public/site-pages";

/**
 * Slug mirrors the live Wix page, "Property Rental Estimation", linked from the fourth
 * card on /property-strategy-services. It now has its own page and form rather than a
 * 301 to the management page.
 */

const page = servicePageBySlug("property-rental-report")!;

export const metadata: Metadata = {
  title: page.metaTitle,
  description: page.metaDescription,
  alternates: { canonical: "/property-rental-report" },
};

export default function Page() {
  return (
    <>
      <ServicePageBody page={page}>
        <FormSection slug="property-rental-report" />
      </ServicePageBody>
    </>
  );
}

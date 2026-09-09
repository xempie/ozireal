import type { Metadata } from "next";
import { FormSection } from "@/components/public/forms/form-section";
import { ServicePageBody } from "@/components/public/page-shell";
import { servicePageBySlug } from "@/components/public/site-pages";

/**
 * Slug mirrors the live Wix page. "Strategy Services" in the site menu.
 */

const page = servicePageBySlug("property-strategy-services")!;

export const metadata: Metadata = {
  title: page.metaTitle,
  description: page.metaDescription,
  alternates: { canonical: "/property-strategy-services" },
};

export default function Page() {
  return (
    <>
      <ServicePageBody page={page}>
        <FormSection slug="property-strategy-services" />
      </ServicePageBody>
    </>
  );
}

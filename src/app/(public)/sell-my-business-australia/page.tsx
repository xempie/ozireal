import type { Metadata } from "next";
import { ServicePageBody } from "@/components/public/page-shell";
import { FormSection } from "@/components/public/forms/form-section";
import { servicePageBySlug } from "@/components/public/site-pages";

/**
 * Slug mirrors the live Wix page, "Sell My Business" in the services row.
 */

const page = servicePageBySlug("sell-my-business-australia")!;

export const metadata: Metadata = {
  title: page.metaTitle,
  description: page.metaDescription,
  alternates: { canonical: "/sell-my-business-australia" },
};

export default function Page() {
  return (
    <>
      <ServicePageBody page={page} />
      <FormSection slug="sell-my-business-australia" />
    </>
  );
}

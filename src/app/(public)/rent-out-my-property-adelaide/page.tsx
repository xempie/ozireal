import type { Metadata } from "next";
import { ServicePageBody } from "@/components/public/page-shell";
import { FormSection } from "@/components/public/forms/form-section";
import { servicePageBySlug } from "@/components/public/site-pages";

/**
 * Slug mirrors the live Wix page, "Rent Out My Property" in the services row.
 */

const page = servicePageBySlug("rent-out-my-property-adelaide")!;

export const metadata: Metadata = {
  title: page.metaTitle,
  description: page.metaDescription,
  alternates: { canonical: "/rent-out-my-property-adelaide" },
};

export default function Page() {
  return (
    <>
      <ServicePageBody page={page}>
        <FormSection slug="rent-out-my-property-adelaide" />
      </ServicePageBody>
    </>
  );
}

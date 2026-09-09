import type { Metadata } from "next";
import { ServicePageBody } from "@/components/public/page-shell";
import { FormSection } from "@/components/public/forms/form-section";
import { servicePageBySlug } from "@/components/public/site-pages";

/**
 * Slug mirrors the live Wix page, "Looking For Land" in the services row.
 */

const page = servicePageBySlug("land-opportunities-sa-adelaide")!;

export const metadata: Metadata = {
  title: page.metaTitle,
  description: page.metaDescription,
  alternates: { canonical: "/land-opportunities-sa-adelaide" },
};

export default function Page() {
  return (
    <>
      <ServicePageBody page={page}>
        <FormSection slug="land-opportunities-sa-adelaide" />
      </ServicePageBody>
    </>
  );
}

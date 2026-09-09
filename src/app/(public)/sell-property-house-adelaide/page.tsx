import type { Metadata } from "next";
import { ServicePageBody } from "@/components/public/page-shell";
import { FormSection } from "@/components/public/forms/form-section";
import { servicePageBySlug } from "@/components/public/site-pages";

/**
 * Slug mirrors the live Wix page of the same name, so the URL keeps its ranking
 * at cutover with no redirect involved.
 */

const page = servicePageBySlug("sell-property-house-adelaide")!;

export const metadata: Metadata = {
  title: page.metaTitle,
  description: page.metaDescription,
  alternates: { canonical: "/sell-property-house-adelaide" },
};

export default function Page() {
  return (
    <>
      <ServicePageBody page={page}>
        <FormSection slug="sell-property-house-adelaide" />
      </ServicePageBody>
    </>
  );
}

import type { Metadata } from "next";
import { FormSection } from "@/components/public/forms/form-section";
import { ServicePageBody } from "@/components/public/page-shell";
import { servicePageBySlug } from "@/components/public/site-pages";

/**
 * Slug mirrors the live Wix page. "Gift Party" in the site menu.
 */

const page = servicePageBySlug("realestate-gift-adelaide")!;

export const metadata: Metadata = {
  title: page.metaTitle,
  description: page.metaDescription,
  alternates: { canonical: "/realestate-gift-adelaide" },
};

export default function Page() {
  return (
    <>
      <ServicePageBody page={page}>
        <FormSection slug="realestate-gift-adelaide" />
      </ServicePageBody>
    </>
  );
}

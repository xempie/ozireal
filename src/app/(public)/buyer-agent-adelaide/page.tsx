import type { Metadata } from "next";
import { ServicePageBody } from "@/components/public/page-shell";
import { FormSection } from "@/components/public/forms/form-section";
import { servicePageBySlug } from "@/components/public/site-pages";

/**
 * Slug mirrors the live Wix page. Buyer advocacy, the one service where the client is
 * the buyer rather than the vendor.
 */

const page = servicePageBySlug("buyer-agent-adelaide")!;

export const metadata: Metadata = {
  title: page.metaTitle,
  description: page.metaDescription,
  alternates: { canonical: "/buyer-agent-adelaide" },
};

export default function Page() {
  return (
    <>
      <ServicePageBody page={page}>
        <FormSection slug="buyer-agent-adelaide" />
      </ServicePageBody>
    </>
  );
}

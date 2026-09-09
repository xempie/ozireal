import type { Metadata } from "next";
import { FormSection } from "@/components/public/forms/form-section";
import { ServicePageBody } from "@/components/public/page-shell";
import { servicePageBySlug } from "@/components/public/site-pages";

/**
 * The live site spells this /oversees-investment. Corrected here, with a 301 from the
 * old spelling in next.config.ts so the indexed URL is never dropped.
 */

const page = servicePageBySlug("overseas-investment")!;

export const metadata: Metadata = {
  title: page.metaTitle,
  description: page.metaDescription,
  alternates: { canonical: "/overseas-investment" },
};

export default function Page() {
  return (
    <>
      <ServicePageBody page={page} />
      <FormSection slug="overseas-investment" />
    </>
  );
}

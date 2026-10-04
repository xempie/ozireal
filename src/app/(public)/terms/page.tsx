import type { Metadata } from "next";
import { LegalPage } from "@/components/public/legal-page";
import { AGENCY } from "@/components/public/agency";

/**
 * Website terms of use. A first draft for the licensee to review.
 */

export const metadata: Metadata = {
  title: "Terms of use",
  description: `The terms that apply when you use the ${AGENCY.name} website.`,
  alternates: { canonical: "/terms" },
};

const A = AGENCY;

export default function Page() {
  return (
    <LegalPage
      eyebrow="Terms"
      title="Website terms"
      titleEm="of use"
      lede={`The terms that apply when you use this website, operated by ${A.name}.`}
      updated="4 October 2026"
      sections={[
        {
          heading: "About these terms",
          body: [
            `This website is operated by ${A.name} (ABN ${A.abn}, ${A.licence}), ${A.office}. By using the website you agree to these terms.`,
          ],
        },
        {
          heading: "Information only, not advice",
          body: [
            "Content on this website is general information. It is not legal, financial, tax or investment advice and does not take your circumstances into account. Get advice that suits your situation before making a decision.",
          ],
        },
        {
          heading: "Listings and prices",
          body: [
            "Property details are provided in good faith from information supplied to us, but we cannot guarantee they are complete or accurate. Check anything that matters to you, including by inspecting the property and reviewing the contract and vendor's statement.",
            "Price guides are written by our agents for each listing and shown exactly as written. A price guide is not a valuation, and properties may sell or lease for a different amount.",
            "Listings may change, go under offer, sell or lease at any time without notice.",
          ],
        },
        {
          heading: "Free reports and appraisals",
          body: [
            "Appraisals, rental estimates and suburb reports are opinions based on available market information at the time. They are not formal valuations and should not be relied on for lending, legal or tax purposes.",
          ],
        },
        {
          heading: "Your enquiries",
          body: [
            "When you send us a form, you agree to us contacting you about your enquiry. We handle your information as set out in our Privacy policy. Marketing is sent only if you opt in, and you can unsubscribe at any time.",
          ],
        },
        {
          heading: "Intellectual property",
          body: [
            `The content, design, photographs and branding on this website belong to ${A.name} or are used with permission. Do not copy or reuse them without our written consent.`,
          ],
        },
        {
          heading: "Links to other websites",
          body: [
            "Where this website links to another site, we do not control and are not responsible for that site's content.",
          ],
        },
        {
          heading: "Liability",
          body: [
            "To the extent the law allows, we are not liable for loss arising from your use of, or reliance on, this website. Nothing in these terms excludes rights you have under the Australian Consumer Law.",
          ],
        },
        {
          heading: "Governing law",
          body: [
            "These terms are governed by the laws of South Australia, and you submit to the courts of South Australia.",
          ],
        },
        {
          heading: "Contact",
          body: [`Questions about these terms go to ${A.email} or ${A.phone}.`],
        },
      ]}
    />
  );
}

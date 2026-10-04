import type { Metadata } from "next";
import { LegalPage } from "@/components/public/legal-page";
import { AGENCY } from "@/components/public/agency";

/**
 * Complaints process. A first draft for the licensee to review.
 */

export const metadata: Metadata = {
  title: "Complaints",
  description: `How to make a complaint to ${AGENCY.name}, how we handle it, and where to go if you are not satisfied.`,
  alternates: { canonical: "/complaints" },
};

const A = AGENCY;

export default function Page() {
  return (
    <LegalPage
      eyebrow="Complaints"
      title="Making a"
      titleEm="complaint"
      lede="If something has gone wrong, we want to hear about it and put it right. Here is how to raise it and what happens next."
      updated="4 October 2026"
      sections={[
        {
          heading: "How to complain",
          body: [
            `Email ${A.email}, phone ${A.phone}, or write to us at ${A.office}. Tell us what happened, when, who you dealt with, and what you would like us to do.`,
            `Your complaint goes to ${A.principal}, ${A.principalTitle}.`,
          ],
        },
        {
          heading: "What happens next",
          body: [
            "We will acknowledge your complaint within 2 business days.",
            "We will look into it, talk to the people involved, and give you our response in writing, usually within 14 days. If it will take longer, we will tell you why and when to expect an answer.",
            "Making a complaint costs nothing and will not affect how we treat you.",
          ],
        },
        {
          heading: "If you are not satisfied",
          body: [
            "Complaints about the conduct of a real estate agent in South Australia can be made to Consumer and Business Services (CBS) at cbs.sa.gov.au or on 131 882.",
            "Complaints about how we handle your personal information can be made to the Office of the Australian Information Commissioner (OAIC) at oaic.gov.au or on 1300 363 992. Our Privacy policy has more detail.",
          ],
        },
      ]}
    />
  );
}

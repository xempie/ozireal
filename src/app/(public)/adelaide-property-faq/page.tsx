import type { Metadata } from "next";
import { PageHero, CtaBand } from "@/components/public/page-shell";

/**
 * Frequently asked questions.
 *
 * `/adelaide-property-faq` mirrors the live Wix page, "FAQ" in the site menu.
 *
 * `<details>` again, and again without a shared `name`: unlike the home page's services
 * accordion, a reader comparing two answers should be able to hold both open. It is the
 * one place where the exclusive behaviour would be actively unhelpful.
 *
 * ## Deliberately not marked up as FAQPage schema
 *
 * The obvious move is schema.org FAQPage JSON-LD for the rich result. Not yet, for two
 * reasons: Google restricted FAQ rich results to authoritative government and health
 * sites in 2023, so it earns nothing here; and several of these answers describe offers
 * with their own terms (two months free, 100 days risk-free), which should be confirmed
 * by the licensee before they are published as structured data the agency asserts.
 */

export const metadata: Metadata = {
  title: "Frequently asked questions",
  description:
    "Common questions about OziRealty: management fees from 2.99%, the two months free and referral bonus, switching agencies, owner portal access and overseas investment.",
  alternates: { canonical: "/adelaide-property-faq" },
};

const FAQS: { q: string; a: string[] }[] = [
  {
    q: "What services can you help me with?",
    a: [
      "Buying, selling, renting, property management, property appraisals, and investment guidance. Whether you are planning a move, growing your portfolio, or just exploring your options, you will get practical advice tailored to your goals.",
    ],
  },
  {
    q: "How do the two months free management and referral bonus work?",
    a: [
      "Two months free management: once you sign with us, your first two months of property management services are provided at no cost.",
      "Referral bonus: if you refer another landlord who signs with us, you earn another two months free of management.",
    ],
  },
  {
    q: "What is the property management fee?",
    a: [
      "From 2.99%, with 100 days risk-free and no middle man between you and the principal.",
      "When comparing agencies, ask for the total of every charge across a full year rather than the headline percentage. That is where management pricing usually stops being comparable.",
    ],
  },
  {
    q: "Which management plan should I choose?",
    a: [
      "Income Protect covers rent collection and disbursement, tenant communication, lease preparation and renewals, and owner portal access.",
      "Income Optimise adds four routine inspections a year, an annual rent review against market data, priority maintenance for plumbing and gardening, and a vacancy minimisation strategy. Income and Risk Shield builds on that again.",
    ],
  },
  {
    q: "Who will I deal with, staff or the owner?",
    a: [
      "You deal directly with Esi Dor, Principal of OziRealty (RLA 350 628). That is what no middle man means in practice.",
    ],
  },
  {
    q: "How soon can I switch from my current agency?",
    a: [
      "It depends on the notice period in your current management agreement, which is usually 30 to 90 days. Send us the agreement and we will tell you what it actually says before you commit to anything.",
    ],
  },
  {
    q: "Can I see my financials and property statements online?",
    a: [
      "Yes. Secure owner portal access is included on every management plan, so statements and financials are available whenever you want them rather than at month end.",
    ],
  },
  {
    q: "Can I terminate management if I am not satisfied?",
    a: [
      "The 100 days risk-free period is there for exactly that. Ask us for the current terms in writing before you sign, and read the notice provisions.",
    ],
  },
  {
    q: "Do you offer help with overseas property investment?",
    a: [
      "Yes. We work with investors looking at Dubai, and we combine real estate advice with financial advising and finance broking so the property and the finance are handled together.",
      "Cross-border purchases carry approval, tax and currency questions a local purchase does not. Confirm your position with an accountant and a solicitor who know your circumstances.",
    ],
  },
  {
    q: "What is the easiest way to reach OziRealty?",
    a: [
      "Call 1800 400 333, or email the desk you need: support@, rent@, sell@, buy@ or oversea@ozirealty.com.au. The office is at 308 Prospect Rd, Prospect SA 5082.",
    ],
  },
];

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="FAQ"
        title="Simple, transparent,"
        titleEm="tailored to you"
        lede="We believe real estate should be simple, transparent, and tailored to your needs. These are the questions we get asked most often."
        image="photo-1583847268964-b28dc8f51f92"
        imageAlt="Living room with a large window"
        facts={["South Australia", "RLA 350 628", "General information only"]}
      />

      <section className="sec">
        <div className="wrap">
          <div className="faq-list">
            {FAQS.map((f) => (
              <details className="faq" key={f.q}>
                <summary className="faq-q">
                  <span>{f.q}</span>
                  <span className="svc-plus" aria-hidden="true" />
                </summary>
                <div className="faq-a">
                  {f.a.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
              </details>
            ))}
          </div>

          {/*
            Not boilerplate. Several answers describe commercial offers with their own
            terms, and CLAUDE.md rule 3 holds the compliance advisor to citing or staying
            silent rather than rendering a definitive ruling. A public FAQ making claims
            about fees and notice periods is the same class of content.
          */}
          <p className="faq-note">
            General information about how we work, current at the time of writing and not
            legal, tax or financial advice. Offers and terms described here are subject to
            change and to their own conditions. Property law in South Australia changes,
            and your circumstances change what applies, so confirm anything that matters
            with a licensed conveyancer or a solicitor before you rely on it.
          </p>
        </div>
      </section>

      <CtaBand
        heading="Cannot find what you are"
        headingEm="looking for?"
        label="Book a free consultation"
        href="/book-online"
      />
    </>
  );
}

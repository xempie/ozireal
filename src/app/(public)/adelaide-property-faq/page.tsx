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
 * sites in 2023, so it earns nothing here; and structured data asserting these are the
 * agency's answers should wait until a licensee has read them. The answers below are
 * demo copy.
 */

export const metadata: Metadata = {
  title: "Frequently asked questions",
  description:
    "Common questions about selling, renting and managing property in South Australia: agent fees, Form 1, cooling off, auction rules and how long a campaign takes.",
  alternates: { canonical: "/adelaide-property-faq" },
};

const FAQS: { q: string; a: string[] }[] = [
  {
    q: "What does it cost to sell a house in Adelaide?",
    a: [
      "Two separate things: the commission, which is a percentage of the sale price, and the marketing, which you pay whether it sells or not. Ask any agent for both numbers in writing, because a low commission attached to a large compulsory marketing package is not a saving.",
      "We charge no commission if the property does not sell.",
    ],
  },
  {
    q: "How long does a campaign usually take?",
    a: [
      "A private treaty campaign typically runs four to six weeks from the first open to a signed contract, and an auction campaign is usually a fixed three or four weeks to the auction date.",
      "The variable is not the campaign length, it is the price. A property priced ahead of the market will still be sitting there at week ten.",
    ],
  },
  {
    q: "What is a Form 1, and when do I need it?",
    a: [
      "The Form 1 is the vendor's statement required in South Australia. It carries the title particulars and the statutory disclosures, and it has to be served on the buyer before settlement, with timing rules that differ between a private treaty sale and an auction.",
      "Getting it wrong can give the buyer a right to walk away, so it is prepared by a conveyancer rather than by us. We will tell you when to engage one, which is earlier than most people expect.",
    ],
  },
  {
    q: "Is there a cooling off period?",
    a: [
      "For a private treaty purchase in South Australia there is a cooling off period for the buyer, with conditions attached and a deadline measured from when the contract and the Form 1 were served. It does not apply in the same way to a property bought at auction.",
      "The specifics matter and they change. Confirm your position with your conveyancer or solicitor rather than relying on a summary on a website, this one included.",
    ],
  },
  {
    q: "Should I sell before I buy, or buy before I sell?",
    a: [
      "In a market that is moving quickly, selling first gives you a real number to buy against and a settlement date to work back from. In a slower market, buying first can be the better risk if your finance genuinely supports both.",
      "It depends on your borrowing position more than on the market, which is why it is a conversation with your broker in the room.",
    ],
  },
  {
    q: "What is your property management fee?",
    a: [
      "From 2.99%, capped, with no letting fee, no admin fee and no statement fee added on top. Routine inspections, statements, end of financial year summaries and tribunal attendance are inside it.",
      "When comparing agencies, ask for the total of every charge across a full year rather than the headline percentage.",
    ],
  },
  {
    q: "Do you manage the property as well as advertise it?",
    a: [
      "We advertise rental properties and we place tenants. Ask us directly about the scope of ongoing management for your property, because it depends on the arrangement and we would rather set the expectation precisely than in a FAQ answer.",
    ],
  },
  {
    q: "Can I get an appraisal without listing?",
    a: [
      "Yes, and most of ours do not turn into listings. It is free, it takes about forty minutes at the property, and there is no obligation attached.",
      "If you are appraising for a bank, an estate or a family agreement rather than a sale, say so and we will write it accordingly.",
    ],
  },
];

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="FAQ"
        title="The questions we"
        titleEm="actually get asked"
        lede="Short answers to the things people ring us about. Where an answer depends on your circumstances, it says so rather than guessing."
        image="photo-1583847268964-b28dc8f51f92"
        imageAlt="Living room with a large window"
        facts={["South Australia", "General information only"]}
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
            Not boilerplate. CLAUDE.md rule 3 holds the compliance advisor to citing or
            staying silent and never rendering a definitive ruling; a public FAQ touching
            Form 1 and cooling off is the same class of content and gets the same framing.
          */}
          <p className="faq-note">
            General information about how we work, current at the time of writing and not
            legal advice. Property law in South Australia changes, and your circumstances
            change what applies. Confirm anything that matters with a licensed conveyancer
            or a solicitor.
          </p>
        </div>
      </section>

      <CtaBand
        heading="Something here we have not"
        headingEm="answered?"
        label="Talk to the office"
        href="/contact"
      />
    </>
  );
}

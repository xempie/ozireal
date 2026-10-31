import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FormSection } from "@/components/public/forms/form-section";
import { servicePageBySlug } from "@/components/public/site-pages";
import { AGENCY, PORTRAIT, photo } from "@/components/public/agency";
import { Fixed } from "@/components/public/fixed";

/**
 * Property investment. Rebuilt 2026-10-31 on the buyer's agent page's structure: the
 * service, a Smart Loanz finance band, the form, a hand-off to Strategy Services, and
 * the FAQ last.
 *
 * "Financial advising" from the old copy is deliberately dropped: it implies an AFSL.
 * Finance points only to Smart Loanz (associated broker, subject to lender approval),
 * and the "not financial advice, no return guaranteed" line stays.
 */

const page = servicePageBySlug("property-investment")!;

export const metadata: Metadata = {
  title: page.metaTitle,
  description:
    "Property investment in Adelaide and overseas: goal first, street-level rental demand, full-year holding costs, and finance planned alongside the purchase.",
  alternates: { canonical: "/property-investment" },
};

const GETS = [
  { hi: "Goal", t: " first", d: "Capital growth, rental yield, tax position or a mix. Which one leads decides the shortlist." },
  { hi: "Street", t: ", not suburb", d: "Rental demand for the specific street, because the suburb median hides the side on a main road." },
  { hi: "Full-year", t: " holding costs", d: "Rates, insurance, management, maintenance, vacancy and interest, including the costs nobody quotes." },
  { pre: "Property and ", hi: "finance together", t: "", d: "The purchase planned around your borrowing position, not the other way round." },
];

const STEPS = [
  { t: "Goal", d: "What you are investing for, your budget and your timeframe." },
  { t: "Numbers", d: "Yield, growth and full-year holding costs, written down." },
  { t: "Shortlist", d: "Properties that fit the goal, in SA or overseas, street by street." },
  { t: "Finance", d: "Borrowing structured alongside the purchase, not after it." },
  { t: "Buy", d: "Negotiation, contract and guidance through to settlement." },
];

/** Also emitted as FAQPage JSON-LD: plain, self-contained answers AI search engines can quote. */
const FAQS = [
  { q: "Is Adelaide a good place to invest in property?", a: "It depends on your goal and the specific street, not just the city. OziRealty compares yield, growth and full-year holding costs for the Adelaide properties that fit your brief." },
  { q: "Should I invest for growth or rental yield?", a: "They often pull in different directions. Which one leads depends on your income, borrowing position and timeframe, and it decides the shortlist." },
  { q: "What costs should I budget for as a property investor?", a: "Beyond the price: council rates, insurance, property management, maintenance, vacancy and loan interest across a full year." },
  { q: "Can you help me invest overseas?", a: "Yes. OziRealty helps with property investment in South Australia and overseas." },
  { q: "How much can I borrow for an investment property?", a: "Book a free finance chat with Smart Loanz, our associated broker, to see your borrowing power. Subject to lender approval." },
  { q: "Is this financial advice?", a: "No. This page describes how we work. Your circumstances decide what applies, tax questions belong with your accountant, and no return is guaranteed." },
];

export default function Page() {
  return (
    <>
      <section className="sl-hero sl-hero--compact">
        <Image className="sl-hero-bg" src={photo(page.image, 1600)} alt="" fill priority sizes="100vw" />
        <div className="wrap">
          <p className="eyebrow">Property investment in Adelaide</p>
          <h1 className="display">
            Invest on the numbers, <em>not the pitch.</em>
          </h1>
          <p className="ss-lede">
            Growth, yield or tax: we start with your goal, then run the{" "}
            <b style={{ color: "#fff" }}>full-year numbers</b> on every property, street by
            street, with finance planned alongside the purchase. In South Australia or overseas.
          </p>
          <div className="sl-acts">
            <a className="btn" href="#enquire">Talk about my goals →</a>
            <a className="btn sl-line" href="#how">How it works</a>
          </div>
          <ul className="ss-trust">
            <li>Written analysis</li>
            <li>South Australia and overseas</li>
            <li>Principal-led</li>
          </ul>
        </div>
      </section>

      <Fixed id="what-you-get">
        <section className="sec">
          <div className="wrap">
            <p className="eyebrow">What you get</p>
            <h2 className="display">
              An investment that <em>stacks up</em>
            </h2>
            <div className="sl-steps mg-gets">
              {GETS.map((g) => (
                <div key={g.hi}>
                  <b>
                    {g.pre}
                    <strong className="mg-hi">{g.hi}</strong>
                    {g.t}
                  </b>
                  <p>{g.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </Fixed>

      <Fixed id="how">
        <section className="sec" id="how" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <p className="eyebrow">How it works</p>
            <h2 className="display">
              From goal to <em>settled investment</em>
            </h2>
            <div className="sl-steps">
              {STEPS.map((s) => (
                <div key={s.t}>
                  <b>{s.t}</b>
                  <p>{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </Fixed>

      <Fixed id="why">
        <section className="sec dark">
          <div className="wrap">
            <p className="eyebrow">Why it matters</p>
            <h2 className="display">
              The price is the <em>least useful number</em>
            </h2>
            <div className="ba-vs">
              <div>
                <h3>Buying on the pitch</h3>
                <ul>
                  <li>Compared on purchase price alone</li>
                  <li>Suburb averages</li>
                  <li>Costs found after settlement</li>
                  <li>Finance sorted last</li>
                </ul>
              </div>
              <div className="ba-us">
                <h3>Investing on the numbers</h3>
                <ul>
                  <li>Yield, growth and tax weighed against your goal</li>
                  <li>Demand for the specific street</li>
                  <li>Full-year holding costs before you commit</li>
                  <li>Finance planned with the purchase</li>
                </ul>
              </div>
            </div>
            <p className="mg-ref">And if a deal does not stack up, we will tell you.</p>
          </div>
        </section>
      </Fixed>

      <Fixed id="finance">
        <section className="ba-loan">
          <div className="wrap ba-loan-in">
            <div>
              <p className="eyebrow">Before you choose a property</p>
              <h2 className="display">
                Know your borrowing power. <em>Free.</em>
              </h2>
              <p>
                Book a free chat with <b>Smart Loanz</b>, our associated broker, and see how
                much you can borrow, your repayments and investment loan options before you
                shortlist.
              </p>
              <small>Subject to lender approval. {AGENCY.licence}</small>
            </div>
            <a
              className="btn ba-loan-btn"
              href="https://www.smartloanz.com.au/book-online"
              target="_blank"
              rel="noopener noreferrer"
            >
              Book my free finance chat →
            </a>
          </div>
        </section>
      </Fixed>

      <Fixed id="form">
        <section className="sec sl-enq" id="enquire">
          <div className="wrap ss-pick-in">
            <div>
              <p className="eyebrow">Start here</p>
              <h2 className="display">
                Tell us what you are <em>investing for</em>
              </h2>
              <p className="ss-for">
                Yield, growth and tax pull in different directions. Your answer decides the
                shortlist.
              </p>
              <div className="sl-esi">
                <Image className="sl-ph" src={PORTRAIT.src} alt={PORTRAIT.alt} width={144} height={144} />
                <div>
                  <b>Esi Dor</b>
                  <span>Founder and principal, reads every enquiry</span>
                </div>
              </div>
            </div>
            <div className="ss-form">
              <FormSection slug="property-investment" bare />
            </div>
          </div>
        </section>
      </Fixed>

      <Fixed id="strategy">
        <section className="sec">
          <div className="wrap">
            <div className="sl-unsure">
              <div>
                <p className="eyebrow">Not sure how to start?</p>
                <h2 className="display">
                  Not sure which suburb <em>or strategy?</em>
                </h2>
                <p>
                  Start with our Strategy Services: free Suburb Insight and Rental Reports that
                  compare growth, yield and demand before you commit.
                </p>
              </div>
              <Link className="btn" href="/property-strategy-services">
                Explore strategy services →
              </Link>
            </div>
          </div>
        </section>
      </Fixed>

      <Fixed id="faq">
        <section className="sec" style={{ paddingTop: 0 }}>
          <div className="wrap" style={{ maxWidth: 820 }}>
            <h2 className="display">
              Property investment in Adelaide: <em>common questions</em>
            </h2>
            {FAQS.map((f) => (
              <details className="ss-faq" key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
            <p className="ss-for" style={{ fontSize: 13.5, marginTop: 18 }}>
              General information only, not financial advice. No return is guaranteed.
            </p>
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: JSON.stringify({
                  "@context": "https://schema.org",
                  "@type": "FAQPage",
                  mainEntity: FAQS.map((f) => ({
                    "@type": "Question",
                    name: f.q,
                    acceptedAnswer: { "@type": "Answer", text: f.a },
                  })),
                }).replace(/</g, "\\u003c"),
              }}
            />
          </div>
        </section>
      </Fixed>

      <div className="ss-sticky">
        <a className="btn" href="#enquire">Talk about my goals</a>
      </div>
    </>
  );
}

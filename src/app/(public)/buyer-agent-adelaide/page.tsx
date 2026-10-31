import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FormSection } from "@/components/public/forms/form-section";
import { servicePageBySlug } from "@/components/public/site-pages";
import { AGENCY, PORTRAIT, photo } from "@/components/public/agency";
import { Fixed } from "@/components/public/fixed";

/**
 * Buyer's agent. Rebuilt 2026-10-31 on the Sell page's structure: the service (what you
 * get, how it works, why use one), a Smart Loanz finance band, then the brief form, a
 * hand-off to Strategy Services, and the FAQ last.
 *
 * "You pay after settlement" is the owner's own term (2026-10-31). The Smart Loanz band
 * keeps "associated broker" and "subject to lender approval": credit advertising must
 * not imply guaranteed or instant approval.
 */

const page = servicePageBySlug("buyer-agent-adelaide")!;

export const metadata: Metadata = {
  title: page.metaTitle,
  description:
    "Buyer's agent in Adelaide: off-market access, inspections and valuation before you bid, and strategic negotiation. You pay only after settlement.",
  alternates: { canonical: "/buyer-agent-adelaide" },
};

const GETS = [
  { hi: "Off-market", t: " access", d: "On-market, pre-market and off-market opportunities, so you see homes before most buyers do." },
  { pre: "Checked ", hi: "before you go", t: "", d: "Building condition assessed and inspections coordinated, so hidden issues surface before you bid." },
  { pre: "A price with ", hi: "evidence", t: " behind it", d: "Valuation, comparable sales and rental yield insight, so your offer is based on the numbers." },
  { hi: "Pay after", t: " settlement", d: "Our fee is charged once you have settled on the property, not before." },
];

const STEPS = [
  { t: "Brief", d: "Your goals, suburbs, budget and must-haves, home or investment." },
  { t: "Search", d: "On, pre and off-market properties shortlisted against your brief." },
  { t: "Due diligence", d: "Inspections, building condition, valuation and comparable sales." },
  { t: "Negotiate", d: "Strategic offers and contract terms, handled with the selling agent." },
  { t: "Settle", d: "Guidance right through to settlement and the keys." },
];

/** Also emitted as FAQPage JSON-LD: plain, self-contained answers AI search engines can quote. */
const FAQS = [
  { q: "What does a buyer's agent do?", a: "A buyer's agent searches, assesses and negotiates on behalf of the buyer, not the vendor. OziRealty covers the search, inspections, valuation, negotiation and guidance through to settlement in Adelaide and South Australia." },
  { q: "When do I pay a buyer's agent?", a: "With OziRealty you pay after you settle on the property, not before." },
  { q: "Can you find off-market properties in Adelaide?", a: "Yes. Searches cover on-market, pre-market and off-market opportunities across Adelaide." },
  { q: "Do you help first-home buyers?", a: "Yes. We guide first-home buyers through the search, due diligence and contract stages." },
  { q: "Do you help investors?", a: "Yes. Investment searches include rental yield insight and a growth review alongside the comparable sales." },
  { q: "How do I know how much I can borrow?", a: "Book a free finance chat with Smart Loanz, our associated broker, to understand your borrowing position before you start bidding. Subject to lender approval." },
];

export default function Page() {
  return (
    <>
      <section className="sl-hero sl-hero--compact">
        <Image className="sl-hero-bg" src={photo(page.image, 1600)} alt="" fill priority sizes="100vw" />
        <div className="wrap">
          <p className="eyebrow">Buyer&rsquo;s agent in Adelaide</p>
          <h1 className="display">
            Buy the right property, <em>on your side.</em>
          </h1>
          <p className="ss-lede">
            We work for you, not the vendor: <b style={{ color: "#fff" }}>off-market</b> access,
            every property checked before you visit, and negotiation that protects your
            price. <b style={{ color: "#fff" }}>You pay after you settle.</b>
          </p>
          <div className="sl-acts">
            <a className="btn" href="#enquire">Send us your brief →</a>
            <a className="btn sl-line" href="#how">How it works</a>
          </div>
          <ul className="ss-trust">
            <li>Off-market access</li>
            <li>Pay after settlement</li>
            <li>Principal-led</li>
          </ul>
        </div>
      </section>

      <Fixed id="what-you-get">
        <section className="sec">
          <div className="wrap">
            <p className="eyebrow">What you get</p>
            <h2 className="display">
              A buyer&rsquo;s agent who is <em>only on your side</em>
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
              From brief to <em>keys</em>
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
            <p className="eyebrow">Why use a buyer&rsquo;s agent</p>
            <h2 className="display">
              Everyone else in the room <em>works for the vendor</em>
            </h2>
            <div className="ba-vs">
              <div>
                <h3>Buying on your own</h3>
                <ul>
                  <li>The selling agent is paid by the vendor</li>
                  <li>You only see what is advertised</li>
                  <li>Hidden issues found after you bid</li>
                  <li>You negotiate against a professional</li>
                </ul>
              </div>
              <div className="ba-us">
                <h3>With OziRealty</h3>
                <ul>
                  <li>On your side, and you pay after settlement</li>
                  <li>Off-market and pre-market access</li>
                  <li>Properties checked before you visit</li>
                  <li>A professional negotiating for you</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </Fixed>

      <Fixed id="finance">
        <section className="ba-loan">
          <div className="wrap ba-loan-in">
            <div>
              <p className="eyebrow">Before you fall in love with a house</p>
              <h2 className="display">
                Know what you can borrow. <em>Free.</em>
              </h2>
              <p>
                Book a free chat with <b>Smart Loanz</b>, our associated broker, and find out
                your borrowing power, repayments and loan options before you bid. It costs
                nothing and puts you ahead of buyers who have not checked.
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
                Send us your <em>property brief</em>
              </h2>
              <p className="ss-for">
                The brief is where it starts. The more specific it is, the fewer wasted
                Saturdays.
              </p>
              <div className="sl-esi">
                <Image className="sl-ph" src={PORTRAIT.src} alt={PORTRAIT.alt} width={144} height={144} />
                <div>
                  <b>Esi Dor</b>
                  <span>Founder and principal, reads every brief</span>
                </div>
              </div>
            </div>
            <div className="ss-form">
              <FormSection slug="buyer-agent-adelaide" bare />
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
                  Not sure where <em>to buy yet?</em>
                </h2>
                <p>
                  If you are still comparing suburbs or deciding between a home and an
                  investment, our Strategy Services help, starting with a free Suburb Insight
                  Report.
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
              Buyer&rsquo;s agents in Adelaide: <em>common questions</em>
            </h2>
            {FAQS.map((f) => (
              <details className="ss-faq" key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
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
        <a className="btn" href="#enquire">Send us your brief</a>
      </div>
    </>
  );
}

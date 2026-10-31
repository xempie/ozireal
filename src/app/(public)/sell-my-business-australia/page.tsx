import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FormSection } from "@/components/public/forms/form-section";
import { servicePageBySlug } from "@/components/public/site-pages";
import { PORTRAIT, photo } from "@/components/public/agency";
import { Fixed } from "@/components/public/fixed";

/**
 * Business brokerage. Rebuilt 2026-10-31 on the shared service structure: the service,
 * the form, a hand-off to Strategy Services, and the FAQ last. No finance band here, by
 * the owner's request.
 */

const page = servicePageBySlug("sell-my-business-australia")!;

export const metadata: Metadata = {
  title: page.metaTitle,
  description: page.metaDescription,
  alternates: { canonical: "/sell-my-business-australia" },
};

const GETS = [
  { hi: "Confidential", t: " by process", d: "The listing describes the business without identifying it. Nothing is discussed with a buyer without your say-so." },
  { pre: "Valued on ", hi: "the books", t: "", d: "A price a buyer will actually underwrite, based on the financials rather than a feeling." },
  { pre: "Buyers ", hi: "qualified first", t: "", d: "Nobody sees anything identifying until they are qualified and under agreement." },
  { pre: "Support to ", hi: "settlement", t: "", d: "Negotiation and contract support right through to settlement." },
];

const STEPS = [
  { t: "Talk", d: "A confidential conversation about the business and your goals." },
  { t: "Value", d: "A valuation built on the numbers a buyer will underwrite." },
  { t: "Prepare", d: "A listing that describes the business without identifying it." },
  { t: "Qualify", d: "Buyers vetted and under agreement before they see more." },
  { t: "Sell", d: "Negotiation, contract and settlement." },
];

/** Also emitted as FAQPage JSON-LD: plain, self-contained answers AI search engines can quote. */
const FAQS = [
  { q: "How do I sell my business confidentially in Australia?", a: "OziRealty writes the listing to describe the business without identifying it, and buyers are qualified and under agreement before they see anything more. Nothing is advertised or discussed with a buyer without your say-so." },
  { q: "How is a business valued for sale?", a: "On the numbers a buyer will actually underwrite: clean, verifiable financials, rather than what the business feels like it is worth." },
  { q: "When is the right time to sell my business?", a: "When the books are in order. If the financials are not clean and verifiable yet, the honest guidance is often to spend a year getting them there before going to market." },
  { q: "Will my staff find out I am selling?", a: "Not from us. Confidentiality is built into the process, because staff, customers and suppliers finding out early is the risk that does real damage." },
  { q: "Do you sell businesses outside Adelaide?", a: "Yes. OziRealty handles confidential business sales Australia wide." },
  { q: "What do I need to prepare?", a: "Recent, verifiable financial statements and an outline of how the business runs. We will tell you what else a buyer will ask for." },
];

export default function Page() {
  return (
    <>
      <section className="sl-hero sl-hero--compact">
        <Image className="sl-hero-bg" src={photo(page.image, 1600)} alt="" fill priority sizes="100vw" />
        <div className="wrap">
          <p className="eyebrow">Sell your business in Australia</p>
          <h1 className="display">
            Selling a business, <em>confidentially.</em>
          </h1>
          <p className="ss-lede">
            Nothing is advertised, and nothing is discussed with a buyer,{" "}
            <b style={{ color: "#fff" }}>without your say-so</b>. A valuation buyers will
            underwrite, qualified buyers only, and support through to settlement.
          </p>
          <div className="sl-acts">
            <a className="btn" href="#enquire">Start a confidential conversation →</a>
            <a className="btn sl-line" href="#how">How it works</a>
          </div>
          <ul className="ss-trust">
            <li>Confidential</li>
            <li>Buyers qualified first</li>
            <li>Australia wide</li>
          </ul>
        </div>
      </section>

      <Fixed id="what-you-get">
        <section className="sec">
          <div className="wrap">
            <p className="eyebrow">What you get</p>
            <h2 className="display">
              A sale that <em>protects the business</em>
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
              From first talk to <em>settlement</em>
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
              The leak that <em>does the damage</em>
            </h2>
            <div className="ba-vs">
              <div>
                <h3>A careless sale</h3>
                <ul>
                  <li>An advert that identifies the business</li>
                  <li>Staff, customers and suppliers find out first</li>
                  <li>Priced on a feeling</li>
                  <li>Anyone can ask for the details</li>
                </ul>
              </div>
              <div className="ba-us">
                <h3>With OziRealty</h3>
                <ul>
                  <li>A listing that does not identify you</li>
                  <li>Nothing discussed without your say-so</li>
                  <li>Valued on verifiable financials</li>
                  <li>Buyers qualified and under agreement first</li>
                </ul>
              </div>
            </div>
            <p className="mg-ref">
              And if the books are not ready yet, we will tell you to wait rather than go to
              market now.
            </p>
          </div>
        </section>
      </Fixed>

      <Fixed id="form">
        <section className="sec sl-enq" id="enquire">
          <div className="wrap ss-pick-in">
            <div>
              <p className="eyebrow">Start here</p>
              <h2 className="display">
                A <em>confidential</em> conversation
              </h2>
              <p className="ss-for">
                Nothing is advertised or discussed with a buyer without your say-so.
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
              <FormSection slug="sell-my-business-australia" bare />
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
                  Selling the business, <em>the property, or both?</em>
                </h2>
                <p>
                  If the sale touches property too, our Strategy Services help you plan the
                  order and the timing, starting with free reports on value and rent.
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
              Selling a business in Australia: <em>common questions</em>
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
        <a className="btn" href="#enquire">Start a confidential conversation</a>
      </div>
    </>
  );
}

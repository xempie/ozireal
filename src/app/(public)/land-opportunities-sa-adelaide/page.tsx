import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FormSection } from "@/components/public/forms/form-section";
import { servicePageBySlug } from "@/components/public/site-pages";
import { AGENCY, PORTRAIT, photo } from "@/components/public/agency";
import { Fixed } from "@/components/public/fixed";

/**
 * Land opportunities. Rebuilt 2026-10-31 on the investment page's structure: the
 * service, a Smart Loanz band (land and construction finance), the form, a hand-off to
 * Strategy Services, and the FAQ last.
 */

const page = servicePageBySlug("land-opportunities-sa-adelaide")!;

export const metadata: Metadata = {
  title: page.metaTitle,
  description: page.metaDescription,
  alternates: { canonical: "/land-opportunities-sa-adelaide" },
};

const GETS = [
  { hi: "Zoning", t: " before price", d: "What the zoning allows and what council is likely to approve, checked before the offer." },
  { pre: "Feasibility ", hi: "in writing", t: "", d: "Subdivision on deep blocks run with council costs included, so you know if it can be split." },
  { pre: "Holding costs ", hi: "counted", t: "", d: "What it costs while you build, and what that does to your return." },
  { hi: "Early", t: " access", d: "What is available now, and what we expect to come up, before it is widely advertised." },
];

const STEPS = [
  { t: "Brief", d: "Area, purpose, land size and timing." },
  { t: "Search", d: "Blocks available now and those about to come up." },
  { t: "Check", d: "Zoning, frontage, easements, services and slope." },
  { t: "Feasibility", d: "Build or subdivision costs and holding costs, in writing." },
  { t: "Secure", d: "Negotiation and contract through to settlement." },
];

/** Also emitted as FAQPage JSON-LD: plain, self-contained answers AI search engines can quote. */
const FAQS = [
  { q: "How do I know what I can build on a block in Adelaide?", a: "It depends on the zoning under South Australia's planning rules, plus frontage, easements, services and slope. OziRealty checks what the zoning allows and what council is likely to approve before you make an offer." },
  { q: "Can I subdivide my block?", a: "Some deep blocks can be split and some cannot, and they often look the same from the street. We run a subdivision feasibility with the council costs included." },
  { q: "What are the holding costs of land?", a: "Council rates, insurance, loan interest and maintenance while you plan and build. We count them because they change the return." },
  { q: "Do you have land that is not advertised yet?", a: "We tell you what is available now and what we expect to come up, so you can move early." },
  { q: "Should I buy land or a house and land package?", a: "Land gives you more control; a package is simpler. OziRealty's New Homes page lists house and land packages across Adelaide, or talk it through with us." },
  { q: "Can I get a loan for land and construction?", a: "Book a free chat with Smart Loanz, our associated broker, about land and construction finance. Subject to lender approval." },
];

export default function Page() {
  return (
    <>
      <section className="sl-hero sl-hero--compact">
        <Image className="sl-hero-bg" src={photo(page.image, 1600)} alt="" fill priority sizes="100vw" />
        <div className="wrap">
          <p className="eyebrow">Land in Adelaide and South Australia</p>
          <h1 className="display">
            Land, and what you can <em>actually build on it.</em>
          </h1>
          <p className="ss-lede">
            Building a home, investing or subdividing: we check the{" "}
            <b style={{ color: "#fff" }}>zoning and feasibility before the price</b>, so you
            know what a block is really worth before you commit.
          </p>
          <div className="sl-acts">
            <a className="btn" href="#enquire">Find me the right block →</a>
            <a className="btn sl-line" href="#how">How it works</a>
          </div>
          <ul className="ss-trust">
            <li>Build, invest or subdivide</li>
            <li>Feasibility first</li>
            <li>What&rsquo;s available and what&rsquo;s coming</li>
          </ul>
        </div>
      </section>

      <Fixed id="what-you-get">
        <section className="sec">
          <div className="wrap">
            <p className="eyebrow">What you get</p>
            <h2 className="display">
              A block that does <em>what you need</em>
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
              From brief to <em>build-ready</em>
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
              Two blocks that look identical <em>from the street</em>
            </h2>
            <div className="ba-vs">
              <div>
                <h3>Buying on the listing</h3>
                <ul>
                  <li>Price and land size only</li>
                  <li>Zoning checked after the offer</li>
                  <li>Easements and services found late</li>
                  <li>Holding costs left out</li>
                </ul>
              </div>
              <div className="ba-us">
                <h3>Buying with OziRealty</h3>
                <ul>
                  <li>What council will let you build</li>
                  <li>Frontage, easements, services and slope checked</li>
                  <li>Subdivision feasibility with council costs</li>
                  <li>Holding costs counted before you commit</li>
                </ul>
              </div>
            </div>
            <p className="mg-ref">
              The deep block quietly worth twice its listing and the one that will never be
              approved photograph exactly the same. We tell you which one you are looking at.
            </p>
          </div>
        </section>
      </Fixed>

      <Fixed id="finance">
        <section className="ba-loan">
          <div className="wrap ba-loan-in">
            <div>
              <p className="eyebrow">Land and construction loans</p>
              <h2 className="display">
                Know what you can borrow. <em>Free.</em>
              </h2>
              <p>
                Book a free chat with <b>Smart Loanz</b>, our associated broker, about land and
                construction finance before you put in an offer.
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
                Tell us what the <em>land is for</em>
              </h2>
              <p className="ss-for">
                Tell us the area and the purpose, and we will send what is available and what
                is coming.
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
              <FormSection slug="land-opportunities-sa-adelaide" bare />
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
                  Land, house and land, <em>or established?</em>
                </h2>
                <p>
                  If you are still weighing land against a new home package or an established
                  property, our Strategy Services help you decide, starting with a free Suburb
                  Insight Report.
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
              Buying land in Adelaide: <em>common questions</em>
            </h2>
            {FAQS.map((f) => (
              <details className="ss-faq" key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
            <p className="ss-for" style={{ fontSize: 14.5, marginTop: 18 }}>
              Looking for a house and land package instead?{" "}
              <Link href="/new-homes-adelaide" style={{ color: "var(--accent)", textDecoration: "underline" }}>
                Browse new homes
              </Link>
              .
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
        <a className="btn" href="#enquire">Find me the right block</a>
      </div>
    </>
  );
}

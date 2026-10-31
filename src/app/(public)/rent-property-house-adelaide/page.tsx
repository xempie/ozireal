import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FormSection } from "@/components/public/forms/form-section";
import { servicePageBySlug } from "@/components/public/site-pages";
import { AGENCY, PORTRAIT, photo } from "@/components/public/agency";
import { Fixed } from "@/components/public/fixed";

/**
 * Slug mirrors the live Wix page. This is the tenant side of renting; the landlord
 * side lives at /manage-property-adelaide.
 *
 * Rebuilt 2026-10-31 on the shared service structure: the service, a checklist of what
 * to prepare, a Smart Loanz "could you buy instead?" band, the form, a hand-off to
 * Strategy Services, and the FAQ last.
 */

const page = servicePageBySlug("rent-property-house-adelaide")!;

export const metadata: Metadata = {
  title: page.metaTitle,
  description: page.metaDescription,
  alternates: { canonical: "/rent-property-house-adelaide" },
};

const GETS = [
  { pre: "Hear about it ", hi: "first", t: "", d: "Registered requirements mean we can tell you about the right properties before the open." },
  { pre: "Inspections you can ", hi: "attend", t: "", d: "Clear inspection times for the properties we are advertising." },
  { pre: "An answer ", hi: "either way", t: "", d: "We tell you the outcome, including when it is no, and if a property goes before we reach you." },
  { hi: "Same-day", t: " assessment", d: "Applications with everything attached are assessed the same day." },
];

const STEPS = [
  { t: "Register", d: "Suburbs, budget, move-in date, occupants and pets." },
  { t: "Hear first", d: "We let you know when a property fits." },
  { t: "Inspect", d: "Attend the inspection time that suits you." },
  { t: "Apply", d: "Send everything in one go for a same-day assessment." },
  { t: "Move in", d: "Lease signed, bond lodged, keys in hand." },
];

/** Also emitted as FAQPage JSON-LD: plain, self-contained answers AI search engines can quote. */
const FAQS = [
  { q: "What documents do I need to rent a house in Adelaide?", a: "Photo ID making up one hundred points between the applicants, proof of income such as two recent payslips, a reference from your last agent or landlord, and pet details if you have one." },
  { q: "How long does a rental application take?", a: "With OziRealty, applications with everything attached are assessed the same day. Missing documents are the usual cause of delay." },
  { q: "Will I hear back if my application is unsuccessful?", a: "Yes. OziRealty tells every applicant the outcome, including when it is no." },
  { q: "Can I rent with a pet in South Australia?", a: "Many properties consider pets. Include your pet's details, registration and desexing status in the application." },
  { q: "How do I hear about rentals before they are widely advertised?", a: "Register your rental requirements and we will tell you about the right properties before the open." },
  { q: "Could I afford to buy instead of renting?", a: "Book a free finance chat with Smart Loanz, our associated broker, to see your borrowing power. Subject to lender approval." },
];

export default function Page() {
  return (
    <>
      <section className="sl-hero sl-hero--compact">
        <Image className="sl-hero-bg" src={photo(page.image, 1600)} alt="" fill priority sizes="100vw" />
        <div className="wrap">
          <p className="eyebrow">Rentals in Adelaide</p>
          <h1 className="display">
            Find your next rental, <em>and hear back.</em>
          </h1>
          <p className="ss-lede">
            Register what you need and we will tell you about the right homes{" "}
            <b style={{ color: "#fff" }}>before the open</b>, not after. Apply with everything
            ready and you get an answer either way.
          </p>
          <div className="sl-acts">
            <a className="btn" href="#enquire">Register my requirements →</a>
            <a className="btn sl-line" href="#ready">What to prepare</a>
          </div>
          <ul className="ss-trust">
            <li>Adelaide wide</li>
            <li>Every application answered</li>
            <li>Houses, units and townhouses</li>
          </ul>
        </div>
      </section>

      <Fixed id="what-you-get">
        <section className="sec">
          <div className="wrap">
            <p className="eyebrow">What you get</p>
            <h2 className="display">
              Renting, <em>without the silence</em>
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
        <section className="sec" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <p className="eyebrow">How it works</p>
            <h2 className="display">
              From search to <em>keys</em>
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

      <Fixed id="ready">
        <section className="sec dark" id="ready">
          <div className="wrap">
            <p className="eyebrow">Before you apply</p>
            <h2 className="display">
              Have these ready <em>as one file</em>
            </h2>
            <ul className="rt-docs">
              {page.points.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <p className="mg-ref">
              If something in your history needs explaining, put it in the application. It is
              far better coming from you than found later.
            </p>
          </div>
        </section>
      </Fixed>

      <Fixed id="finance">
        <section className="ba-loan">
          <div className="wrap ba-loan-in">
            <div>
              <p className="eyebrow">Renting now, buying later?</p>
              <h2 className="display">
                Could you buy instead? <em>Find out free.</em>
              </h2>
              <p>
                Book a free chat with <b>Smart Loanz</b>, our associated broker, and see what you
                could borrow, what repayments would look like, and whether a first home is
                closer than you think.
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
                Register your <em>rental requirements</em>
              </h2>
              <p className="ss-for">
                So we can tell you about the right properties before the open, rather than after.
              </p>
              <div className="sl-esi">
                <Image className="sl-ph" src={PORTRAIT.src} alt={PORTRAIT.alt} width={144} height={144} />
                <div>
                  <b>Esi Dor</b>
                  <span>Founder and principal</span>
                </div>
              </div>
            </div>
            <div className="ss-form">
              <FormSection slug="rent-property-house-adelaide" bare />
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
                  Rent or buy? <em>Weigh it up first.</em>
                </h2>
                <p>
                  If you are wondering whether to keep renting or start buying, our Strategy
                  Services help you compare, with free suburb and rental reports.
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
              Renting in Adelaide: <em>common questions</em>
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
        <a className="btn" href="#enquire">Register my requirements</a>
      </div>
    </>
  );
}

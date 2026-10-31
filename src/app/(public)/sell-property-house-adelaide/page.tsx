import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FormSection } from "@/components/public/forms/form-section";
import { servicePageBySlug } from "@/components/public/site-pages";
import { PORTRAIT, photo } from "@/components/public/agency";

import { Fixed } from "@/components/public/fixed";
/**
 * Slug mirrors the live Wix page of the same name, so the URL keeps its ranking
 * at cutover with no redirect involved.
 *
 * Rebuilt 2026-10-31 in the owner's order: the selling service first (hero, how a sale
 * runs, why us, the appraisal report), then the existing sell form, then a hand-off to
 * Strategy Services for owners not sure selling is the move, and the FAQ last.
 */

const page = servicePageBySlug("sell-property-house-adelaide")!;

export const metadata: Metadata = {
  title: page.metaTitle,
  description: page.metaDescription,
  alternates: { canonical: "/sell-property-house-adelaide" },
};

const STEPS = [
  { t: "Appraisal", d: "Your free report: value range, comparable sales and buyer demand." },
  { t: "Strategy", d: "Price, method and timing agreed with you, based on the numbers." },
  { t: "Preparation", d: "Presentation, photography and the listing copy, ready for launch." },
  { t: "Campaign", d: "Marketing, inspections and buyer follow-up, reported back to you." },
  { t: "Sold", d: "Negotiation through to contract and settlement." },
];

const WHY = [
  { t: "The principal runs your sale", d: "Esi Dor handles your appraisal, campaign and negotiation directly, not a junior." },
  { t: "Pricing backed by evidence", d: "Every recommendation shows the comparable sales and demand data behind it." },
  { t: "Straight answers", d: "If selling is not your best move right now, you will hear that first." },
];

/** Also emitted as FAQPage JSON-LD: plain, self-contained answers AI search engines can quote. */
const FAQS = [
  { q: "How much is my house worth in Adelaide?", a: "It depends on recent comparable sales nearby, land size, condition and current buyer demand. OziRealty's free appraisal report gives a value range built from those sales, not an automated online estimate." },
  { q: "When is the best time to sell in Adelaide?", a: "Spring is traditionally busy, but the right time depends on buyer demand in your suburb and your own plans. The appraisal shows current demand for your property so you can time the sale on evidence." },
  { q: "Should I sell by auction or private treaty?", a: "It depends on the property, the suburb and the depth of buyers. Your selling strategy recommends a method with the reasons behind it." },
  { q: "How should I price my home?", a: "On comparable recent sales and real buyer demand, not on what you need or what a neighbour hoped for. Overpricing usually costs time on the market and, in the end, money." },
  { q: "Should I sell or keep it and rent it out?", a: "The appraisal report includes a rental yield estimate, so you can compare selling with holding before deciding." },
  { q: "Is the appraisal really free?", a: "Yes. The premium appraisal report is valued at $399, is free, and carries no obligation to list." },
  { q: "Who will sell my property?", a: "Esi Dor, the founder and principal of OziRealty, a licensed real estate agency in South Australia." },
];

export default function Page() {
  return (
    <>
      <section className="sl-hero">
        <Image className="sl-hero-bg" src={photo(page.image, 1600)} alt="" fill priority sizes="100vw" />
        <div className="wrap">
          <p className="eyebrow">Selling in Adelaide</p>
          <h1 className="display">
            Sell with a strategy, <em>not a guess.</em>
          </h1>
          <p className="ss-lede">
            Selling with OziRealty means one experienced agent from appraisal to settlement:
            honest pricing from real sales, a campaign that reaches the right buyers, and
            negotiation that protects your result.
          </p>
          <div className="sl-acts">
            <a className="btn" href="#enquire">Get my free appraisal →</a>
            <a className="btn sl-line" href="#how">How we sell</a>
          </div>
          <ul className="ss-trust">
            <li>Free appraisal, valued at $399</li>
            <li>No obligation, no pressure</li>
            <li>Prepared by the principal</li>
          </ul>
        </div>
      </section>

      <Fixed id="how">
        <section className="sec" id="how">
          <div className="wrap">
            <p className="eyebrow">How a sale runs</p>
            <h2 className="display">
              From appraisal to <em>settlement</em>
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
        <section className="sec dark sl-why">
          <div className="wrap">
            <p className="eyebrow">Why sell with OziRealty</p>
            <h2 className="display">
              One agent, <em>start to finish</em>
            </h2>
            <div className="sl-cards">
              {WHY.map((w) => (
                <div key={w.t}>
                  <b>{w.t}</b>
                  <p>{w.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </Fixed>

      <Fixed id="report">
        <section className="sec">
          <div className="wrap sl-report">
            <div>
              <p className="eyebrow">Your free appraisal report</p>
              <h2 className="display">
                Know your number <em>before you list.</em>
              </h2>
              <p className="ss-for">
                Not an online estimate. A written report built from the homes that actually
                sold near you, with a plan to lift your result.
              </p>
              <p className="ss-for">
                And if the numbers say holding is the better move this year, the report shows
                that too.
              </p>
            </div>
            <div className="sl-doc">
              <span className="sl-val">Valued at $399</span>
              <ol>
                {page.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ol>
            </div>
          </div>
        </section>
      </Fixed>

      <Fixed id="form">
        <section className="sec sl-enq" id="enquire">
          <div className="wrap ss-pick-in">
            <div>
              <p className="eyebrow">Start here</p>
              <h2 className="display">
                Get your free <em>appraisal report</em>
              </h2>
              <p className="ss-for">Free, no obligation, and it shows the comparable sales it came from.</p>
              <div className="sl-esi">
                <Image className="sl-ph" src={PORTRAIT.src} alt={PORTRAIT.alt} width={144} height={144} />
                <div>
                  <b>Esi Dor</b>
                  <span>Founder and principal, reads every request</span>
                </div>
              </div>
            </div>
            <div className="ss-form">
              <FormSection slug="sell-property-house-adelaide" bare />
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
                  Selling might not be <em>your only option.</em>
                </h2>
                <p>
                  If you are still weighing selling against renting out, buying first or
                  investing, our Strategy Services help you decide, with free reports on value,
                  rent and suburbs.
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
              Selling in Adelaide: <em>common questions</em>
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
        <a className="btn" href="#enquire">Get my free appraisal</a>
      </div>
    </>
  );
}

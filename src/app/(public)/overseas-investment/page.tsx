import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FormSection } from "@/components/public/forms/form-section";
import { servicePageBySlug } from "@/components/public/site-pages";
import { AGENCY, PORTRAIT, photo } from "@/components/public/agency";
import { Fixed } from "@/components/public/fixed";

/**
 * The live site spells this /oversees-investment. Corrected here, with a 301 from the
 * old spelling in next.config.ts so the indexed URL is never dropped.
 *
 * Rebuilt 2026-10-31 on the shared service structure. "Financial advising" is dropped
 * (it implies an AFSL), the Smart Loanz band is about equity and borrowing power here
 * in Australia, and the "not legal, tax or financial advice" line stays.
 */

const page = servicePageBySlug("overseas-investment")!;

export const metadata: Metadata = {
  title: page.metaTitle,
  description:
    "Invest in Dubai property from Australia with OziRealty: market comparison, property selection, finance planning and guidance through to settlement.",
  alternates: { canonical: "/overseas-investment" },
};

const GETS = [
  { hi: "Dubai", t: " portfolio", d: "Selected opportunities in a dynamic global hub, matched to your goal and budget." },
  { pre: "Australia vs Dubai, ", hi: "compared", t: "", d: "A side-by-side look at the two markets, backed by industry data, before you decide." },
  { hi: "End-to-end", t: " guidance", d: "From property selection and market analysis through to finance and settlement." },
  { hi: "Risk-aware", t: " planning", d: "Strategy matched to your long-term goals, with the approval, tax and currency questions raised early." },
];

const STEPS = [
  { t: "Register", d: "Your goal, budget and timeframe. Nothing is committed." },
  { t: "Compare", d: "The Australian and Dubai markets, side by side." },
  { t: "Select", d: "Properties that fit, with the numbers behind them." },
  { t: "Finance", d: "Funding planned, including equity you hold in Australia." },
  { t: "Settle", d: "Guided through purchase and settlement." },
];

/** Also emitted as FAQPage JSON-LD: plain, self-contained answers AI search engines can quote. */
const FAQS = [
  { q: "Can Australians buy property in Dubai?", a: "Yes, foreign buyers can purchase property in designated areas of Dubai. OziRealty guides Australian investors from property selection through to settlement." },
  { q: "Why invest in Dubai instead of Australia?", a: "It depends on your goals. We compare the Australian and Dubai markets side by side, using industry data, so you can weigh growth, yield and risk before deciding." },
  { q: "How do I fund an overseas property purchase?", a: "Many investors use equity in their Australian property. Book a free chat with Smart Loanz, our associated broker, to understand your borrowing power. Subject to lender approval." },
  { q: "What are the risks of investing overseas?", a: "Cross-border purchases carry approval, tax and currency questions that a local purchase does not, and they change. We raise them early, and you should confirm your position in writing with an accountant and a solicitor." },
  { q: "Do I have to commit when I register?", a: "No. Registering only gets you the portfolio and the market comparison. Nothing is committed." },
  { q: "Is this financial advice?", a: "No. This page is general information about how we work. It is not legal, tax or financial advice, and no return is guaranteed." },
];

export default function Page() {
  return (
    <>
      <section className="sl-hero sl-hero--compact">
        <Image className="sl-hero-bg" src={photo(page.image, 1600)} alt="" fill priority sizes="100vw" />
        <div className="wrap">
          <p className="eyebrow">Overseas investment from Australia</p>
          <h1 className="display">
            Unlock Dubai: <em>a gateway to smart investment.</em>
          </h1>
          <p className="ss-lede">
            Invest beyond Australia with an Adelaide agency beside you:{" "}
            <b style={{ color: "#fff" }}>the two markets compared</b>, properties selected to
            your goal, and guidance from first look through to settlement.
          </p>
          <div className="sl-acts">
            <a className="btn" href="#enquire">Register my interest →</a>
            <a className="btn sl-line" href="#how">How it works</a>
          </div>
          <ul className="ss-trust">
            <li>Dubai portfolio</li>
            <li>Australia vs Dubai comparison</li>
            <li>Nothing committed by registering</li>
          </ul>
        </div>
      </section>

      <Fixed id="what-you-get">
        <section className="sec">
          <div className="wrap">
            <p className="eyebrow">What you get</p>
            <h2 className="display">
              Cross-border investing, <em>without the gaps</em>
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
              From interest to <em>settlement</em>
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
              Investing overseas <em>is not like buying locally</em>
            </h2>
            <div className="ba-vs">
              <div>
                <h3>Going it alone</h3>
                <ul>
                  <li>Unfamiliar market and agents</li>
                  <li>Approval, tax and currency questions found late</li>
                  <li>Finance sorted after the property</li>
                  <li>No one comparing it with home</li>
                </ul>
              </div>
              <div className="ba-us">
                <h3>With OziRealty</h3>
                <ul>
                  <li>An Adelaide agency guiding you end to end</li>
                  <li>Cross-border questions raised early</li>
                  <li>Finance planned alongside the purchase</li>
                  <li>Australia and Dubai compared with data</li>
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
              <p className="eyebrow">Funding it from Australia</p>
              <h2 className="display">
                Know what your equity can do. <em>Free.</em>
              </h2>
              <p>
                Book a free chat with <b>Smart Loanz</b>, our associated broker, about your
                borrowing power and the equity in your Australian property before you invest.
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
                Register your <em>interest</em>
              </h2>
              <p className="ss-for">
                Tell us what you are investing for and when, and we will send the portfolio and
                the market comparison. Nothing is committed by registering.
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
              <FormSection slug="overseas-investment" bare />
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
                  Overseas or <em>closer to home?</em>
                </h2>
                <p>
                  If you are still deciding whether to invest in Australia or abroad, our
                  Strategy Services help you weigh it up, with free suburb and rental reports.
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
              Investing in Dubai from Australia: <em>common questions</em>
            </h2>
            {FAQS.map((f) => (
              <details className="ss-faq" key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
            <p className="ss-for" style={{ fontSize: 13.5, marginTop: 18 }}>
              General information only, not legal, tax or financial advice. No return is
              guaranteed.
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
        <a className="btn" href="#enquire">Register my interest</a>
      </div>
    </>
  );
}

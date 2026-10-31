import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FormSection } from "@/components/public/forms/form-section";
import { MANAGEMENT_PLANS, PORTRAIT, photo } from "@/components/public/agency";
import { Fixed } from "@/components/public/fixed";

/**
 * Property management.
 *
 * `/manage-property-adelaide` mirrors the live Wix page, "Manage My Property" in the
 * site's services row. Rebuilt 2026-10-31 on the Sell page's structure: the service
 * (what you get, the four plans with Income & Risk Shield recommended, how we work),
 * then the form, then a hand-off to Strategy Services, and the FAQ last.
 *
 * The commercial terms (from 2.99%, 100 days risk-free, no middle man, two months free
 * on a referral, the plan contents) are the agency's own, confirmed by the owner.
 */

export const metadata: Metadata = {
  title: "Property Management From 2.99%",
  description:
    "Adelaide property management from 2.99% with 100 days risk-free. Four plans, cost-effective maintenance, professional tenancy dispute handling, and your property cared for as your most important asset.",
  alternates: { canonical: "/manage-property-adelaide" },
};

const GETS = [
  { hi: "From 2.99%", t: " commission", d: "Full management from 2.99%, with the full fee schedule in writing before you sign." },
  { pre: "Cared for as ", hi: "your most important asset", t: "", d: "Careful tenant screening, routine inspections and a close eye on condition, because for most owners it is." },
  { hi: "Cost-effective", t: " maintenance", d: "Repairs handled early with quotes that make sense, so small issues stay small and costs stay down." },
  { hi: "Professional", t: " tenancy dispute resolution", d: "Arrears, bond claims and disputes handled calmly and properly, through to the tribunal if needed." },
];

const PILLARS = [
  { t: "Deal directly with the business owner", d: "Your investment gets full attention. There is no middle man." },
  { t: "Compliance, completely", d: "Every compliance obligation handled in full." },
  { t: "Trust account", d: "We use a trust account for all client funds." },
  { t: "REISA standards", d: "We operate under the REISA standards." },
];

/** Also emitted as FAQPage JSON-LD: plain, self-contained answers AI search engines can quote. */
const FAQS = [
  { q: "How much does a property manager cost in Adelaide?", a: "Fees vary by agency and by what is included. OziRealty's property management in Adelaide starts from 2.99%, with the full fee schedule in writing before you sign." },
  { q: "Which management plan should I choose?", a: "Most owners are best covered by Income & Risk Shield: it adds tribunal attendance, end-to-end maintenance, insurance claim support and after-hours emergencies to everything in the other plans." },
  { q: "How do you handle tenancy disputes?", a: "Professionally and on the record: clear communication first, then the arrears and bond processes, and tribunal attendance where needed." },
  { q: "How do you keep maintenance costs down?", a: "Issues are dealt with early, before they become expensive, using tradespeople and quotes that make sense for the job." },
  { q: "Can I switch from my current agency?", a: "Yes. Tell us who manages the property now and we will explain how the handover works." },
  { q: "How are my rent and funds held?", a: "All client funds are held in a trust account, and OziRealty operates under the REISA standards." },
];

export default function Page() {
  return (
    <>
      <section className="sl-hero">
        <Image className="sl-hero-bg" src={photo("photo-1605146769289-440113cc3d00", 1600)} alt="" fill priority sizes="100vw" />
        <div className="wrap">
          <p className="eyebrow">Property management in Adelaide</p>
          <h1 className="display">
            More care, <em>less cost.</em>
          </h1>
          <p className="ss-lede">
            Management from <b style={{ color: "#fff" }}>2.99%</b>, run directly by the
            business owner. We look after your rental as your most important asset: the
            right tenants, cost-effective maintenance, and professional handling when a
            tenancy dispute comes up.
          </p>
          <div className="sl-acts">
            <a className="btn" href="#enquire">Get my management quote →</a>
            <a className="btn sl-line" href="#plans">Compare plans</a>
          </div>
          <ul className="ss-trust">
            <li><b>From 2.99%</b> management fee</li>
            <li>100 days risk-free</li>
            <li>No middle man</li>
          </ul>
        </div>
      </section>

      <Fixed id="what-you-get">
        <section className="sec">
          <div className="wrap">
            <p className="eyebrow">What you get</p>
            <h2 className="display">
              Your property, <em>treated as your biggest asset</em>
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

      <Fixed id="plans">
        <section className="sec dark" id="plans">
          <div className="wrap">
            <p className="eyebrow">Plans</p>
            <h2 className="display">
              Choose your level of <em>protection</em>
            </h2>
            <div className="mg-plans">
              {MANAGEMENT_PLANS.map((p) => {
                const rec = "recommended" in p && p.recommended;
                return (
                  <div className={rec ? "mg-plan mg-rec" : "mg-plan"} key={p.name}>
                    {rec && <span className="mg-rb">★ Recommended</span>}
                    <h3>{p.name}</h3>
                    <p className="mg-who">{p.who}</p>
                    <ul>
                      {p.points.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                    <a className="btn" href="#enquire">
                      {rec ? "Choose Risk Shield →" : p.name === "Owner-Designed Plan" ? "Design my plan" : `Choose ${p.name.replace("Income ", "")}`}
                    </a>
                  </div>
                );
              })}
            </div>
            <p className="mg-ref">On every plan: refer another landlord who signs with us and you both get two months fee-free.</p>
          </div>
        </section>
      </Fixed>

      <Fixed id="how-we-work">
        <section className="sec">
          <div className="wrap">
            <p className="eyebrow">How we work</p>
            <h2 className="display">
              Run properly, <em>by the owner</em>
            </h2>
            <div className="mg-pillars">
              {PILLARS.map((p, i) => (
                <div key={p.t}>
                  <i>0{i + 1}</i>
                  <b>{p.t}</b>
                  <p>{p.d}</p>
                </div>
              ))}
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
                Get your <em>management quote</em>
              </h2>
              <p className="ss-for">
                Tell us about the property and we will come back with what management would
                cost, what it would earn, and a free rental appraisal if you want one.
              </p>
              <div className="sl-esi">
                <Image className="sl-ph" src={PORTRAIT.src} alt={PORTRAIT.alt} width={144} height={144} />
                <div>
                  <b>Esi Dor</b>
                  <span>Founder and principal, manages directly</span>
                </div>
              </div>
            </div>
            <div className="ss-form">
              <FormSection slug="manage-property-adelaide" bare />
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
                  Rent it out, sell, <em>or hold?</em>
                </h2>
                <p>
                  If you are still deciding what to do with the property, our Strategy
                  Services help you weigh it up, with free reports on rent, value and suburbs.
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
              Property management in Adelaide: <em>common questions</em>
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
        <a className="btn" href="#enquire">Get my management quote</a>
      </div>
    </>
  );
}

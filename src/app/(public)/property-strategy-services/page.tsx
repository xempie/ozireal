import type { Metadata } from "next";
import { FormSection } from "@/components/public/forms/form-section";
import { servicePageBySlug } from "@/components/public/site-pages";
import Image from "next/image";
import { PORTRAIT, REPORTS } from "@/components/public/agency";
import { GoalPicker } from "@/components/public/goal-picker";

import { Fixed } from "@/components/public/fixed";
/**
 * "Strategy Services", rebuilt 2026-10-31 around one question: what is the visitor
 * deciding? The hero offers four goals; choosing one swaps the panel below to that
 * report, with its own existing enquiry form beside it (the same forms as the four
 * report pages, so consent wording and the CRM path are unchanged). All four panels are
 * server-rendered; GoalPicker only toggles which one is visible.
 */

const page = servicePageBySlug("property-strategy-services")!;

export const metadata: Metadata = {
  title: page.metaTitle,
  description: page.metaDescription,
  alternates: { canonical: "/property-strategy-services" },
};

const GOALS = [
  {
    k: "appraisal",
    icon: "🏠",
    goal: "What my home is worth",
    hint: "Selling, refinancing or curious",
    badge: "Valued at $399 · free",
    title: REPORTS.appraisal.title,
    for: "For owners who want an honest number before selling, refinancing or renovating.",
    items: REPORTS.appraisal.items,
    form: "free-property-appraisal-sa",
  },
  {
    k: "suburb",
    icon: "📍",
    goal: "Where to buy or invest",
    hint: "Compare suburbs before you commit",
    badge: "For buyers and investors",
    title: REPORTS.suburb.title,
    for: "For buyers and investors comparing suburbs before committing.",
    items: REPORTS.suburb.items.slice(0, 8),
    form: "free-suburb-insight-report",
  },
  {
    k: "rental",
    icon: "🔑",
    goal: "What it will rent for",
    hint: "Landlords and investors",
    badge: "For landlords",
    title: REPORTS.rental.title,
    for: "Smart rent, stable income, zero guesswork.",
    items: REPORTS.rental.items,
    form: "property-rental-report",
  },
  {
    k: "consult",
    icon: "💬",
    goal: "I'm not sure yet",
    hint: "Talk it through with Esi",
    badge: "One-on-one with the principal",
    title: "Free Property Consultation",
    for: "Not sure which report you need? Talk it through with Esi first.",
    items: REPORTS.consultation.items,
    form: "book-online",
  },
] as const;

/** Also emitted as FAQPage JSON-LD: plain, self-contained answers AI search engines can quote. */
const FAQS = [
  { q: "What is a property strategy service?", a: "A property strategy service uses real sales, rental and demand data to plan your next move, whether that is selling, buying, investing or leasing, so the decision rests on evidence rather than guesswork. At OziRealty in Adelaide it starts with a free report on your property or suburb." },
  { q: "Is the property appraisal really free?", a: "Yes. The Premium Appraisal Report, the Suburb Insight Report, the Rental Report and the consultation are all free and carry no obligation to list, buy or sign anything." },
  { q: "How much is my house worth in Adelaide?", a: "Value depends on recent comparable sales in your street and suburb, land size, condition and current buyer demand. The free appraisal gives a current market value range built from comparable sales, rather than an automated online estimate." },
  { q: "Which Adelaide suburbs are good to buy or invest in?", a: "It depends on your budget, goals and timeframe. The free Suburb Insight Report compares median prices, rental yields, vacancy rates, growth performance and buyer demand, so you can weigh suburbs side by side before committing." },
  { q: "How much rent can I get for my property in Adelaide?", a: "The free Rental Report gives an accurate weekly rent range from comparable nearby rentals, plus vacancy and tenant demand insights and a pricing strategy to minimise vacancy." },
  { q: "Do I need a property strategy if I only own one home?", a: "It helps. Owner-occupiers use a strategy to decide when to sell, whether to renovate, or whether to keep the home and rent it out. The questions are the same; only the scale differs." },
  { q: "Can overseas buyers get property guidance in South Australia?", a: "Yes. OziRealty helps overseas investors understand the South Australian market and the steps involved in buying. Start with a free consultation to discuss your situation." },
  { q: "Who prepares the reports?", a: "Esi Dor, the founder and principal of OziRealty, a licensed real estate agency in South Australia. You deal with the principal directly, not a call centre." },
  { q: "Will I be pressured to sell or list?", a: "No. The report is yours to use however you like." },
  { q: "Which report should I pick?", a: "Choose the question closest to yours at the top of this page. If none fits, pick \"I'm not sure yet\" and Esi will point you to the right one." },
];

export default function Page() {
  return (
    <>
      <GoalPicker />
      <section className="ss-hero">
        <div className="wrap">
          <p className="eyebrow">Strategy services · Free, no obligation</p>
          <h1 className="display">
            Turn property into a strategy, <em>not a guess.</em>
          </h1>
          <p className="ss-lede">
            Tell us what you are weighing up. We send back the report that answers it,
            prepared by Esi, not a call centre.
          </p>
          <p className="ss-q" id="ss-q">What are you trying to decide?</p>
          <div className="ss-goals" role="group" aria-labelledby="ss-q">
            {GOALS.map((g, i) => (
              <button
                type="button"
                className="goal"
                data-goal={g.k}
                aria-pressed={i === 0}
                key={g.k}
              >
                <span className="ss-ic" aria-hidden="true">{g.icon}</span>
                <b>{g.goal}</b>
                <span>{g.hint}</span>
              </button>
            ))}
          </div>
          <ul className="ss-trust">
            <li>Free, no obligation</li>
            <li>Prepared by a licensed agent</li>
            <li>Read by Esi personally</li>
          </ul>
        </div>
      </section>

      <Fixed id="form">
        <section className="ss-pick" id="pick">
          {GOALS.map((g, i) => (
            <div className="wrap ss-pick-in" data-panel={g.k} hidden={i !== 0} key={g.k}>
              <div>
                <span className="ss-badge">{g.badge}</span>
                <h2 className="display">{g.title}</h2>
                <p className="ss-for">{g.for}</p>
                <ul className="ss-items">
                  {g.items.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
              </div>
              <div className="ss-form">
                <FormSection slug={g.form} bare />
              </div>
            </div>
          ))}
        </section>
      </Fixed>

      <Fixed id="how">
        <section className="sec">
          <div className="wrap">
            <p className="eyebrow">How it works</p>
            <h2 className="display">
              From question to <em>clear answer</em>
            </h2>
            <div className="ss-how">
              <div>
                <b>Tell us the question</b>
                <p>Pick what you are deciding and give us the address or suburb.</p>
              </div>
              <div>
                <b>Esi prepares the report</b>
                <p>Real sales, rents and demand data for your area, read by someone who works it every day.</p>
              </div>
              <div>
                <b>Decide with confidence</b>
                <p>Use it on your own, or talk it through. There is no obligation either way.</p>
              </div>
            </div>
          </div>
        </section>
      </Fixed>

      <Fixed id="esi">
        <section className="sec" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="ss-esi">
              <Image className="ss-ph" src={PORTRAIT.src} alt={PORTRAIT.alt} width={220} height={220} />
              <div>
                <h3>You deal with Esi Dor, directly.</h3>
                <p>The principal reads every request and prepares every report. Prefer to talk first? Book a free consultation.</p>
              </div>
              <a className="btn ss-cta" href="#pick" data-goal="consult">
                Book a free chat →
              </a>
            </div>
          </div>
        </section>
      </Fixed>

      <Fixed id="faq">
        <section className="sec" style={{ paddingTop: 0 }}>
          <div className="wrap" style={{ maxWidth: 820 }}>
            <h2 className="display">
              Property strategy in Adelaide: <em>common questions</em>
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
        <a className="btn" href="#pick">Get my free report</a>
        <a className="btn ss-ghost" href="#pick" data-goal="consult">Talk to Esi</a>
      </div>
    </>
  );
}

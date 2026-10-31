import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FormSection } from "@/components/public/forms/form-section";
import { AGENCY, PORTRAIT, photo } from "@/components/public/agency";
import { AudiencePicker } from "@/components/public/audience-picker";
import { Fixed } from "@/components/public/fixed";

/**
 * Our services, `/property-services` (mirrors the live Wix page).
 *
 * Rebuilt 2026-10-31 as a doorway: an "I am…" picker filters the service cards, each card
 * carries its page's headline promise, and the general form moves to the end for anyone
 * still unsure. Every promise here is one the owner approved on the service page itself.
 */

export const metadata: Metadata = {
  title: "Real Estate Services in Adelaide",
  description:
    "Adelaide real estate services from one owner-run office: selling, property management from 2.99%, buyer's agent, new homes, investment, land, rentals and business sales.",
  alternates: { canonical: "/property-services" },
};

const AUDIENCES = [
  { key: "owner", label: "I own a property" },
  { key: "buyer", label: "I'm buying" },
  { key: "investor", label: "I'm investing" },
  { key: "renter", label: "I'm renting" },
  { key: "business", label: "I own a business" },
];

const CARDS = [
  { a: "owner", aud: "Owners", t: "Sell my property", pre: "A ", hi: "free appraisal valued at $399", post: ", then a campaign built on comparable sales.", go: "Sell with a strategy", href: "/sell-property-house-adelaide", feat: true },
  { a: "owner investor", aud: "Owners · Investors", t: "Manage my property", pre: "From ", hi: "2.99%", post: ", with Income & Risk Shield recommended and 100 days risk-free.", go: "Compare plans", href: "/manage-property-adelaide" },
  { a: "buyer", aud: "Buyers", t: "Buyer's agent", pre: "Off-market access and negotiation on your side. ", hi: "You pay after you settle.", post: "", go: "Send your brief", href: "/buyer-agent-adelaide" },
  { a: "buyer investor", aud: "Buyers · Investors", t: "New homes", pre: "House and land, townhouses and apartments, ", hi: "with prices on show", post: ".", go: "Browse new homes", href: "/new-homes-adelaide" },
  { a: "investor", aud: "Investors", t: "Invest in property", pre: "Goal first, ", hi: "full-year numbers", post: ", street by street.", go: "Talk about your goals", href: "/property-investment" },
  { a: "investor", aud: "Investors", t: "Overseas investment", pre: "Dubai opportunities with ", hi: "Australia and Dubai compared", post: ".", go: "Register interest", href: "/overseas-investment" },
  { a: "buyer investor", aud: "Buyers · Investors", t: "Looking for land", pre: "", hi: "Zoning and feasibility before the price", post: ", so you know what you can build.", go: "Find the right block", href: "/land-opportunities-sa-adelaide" },
  { a: "renter", aud: "Renters", t: "I need to rent", pre: "Hear about homes ", hi: "before the open", post: ", and an answer either way.", go: "Register requirements", href: "/rent-property-house-adelaide" },
  { a: "business", aud: "Business owners", t: "Sell my business", pre: "Valued on the books, buyers qualified first, ", hi: "completely confidential", post: ".", go: "Start a confidential talk", href: "/sell-my-business-australia" },
];

const PILLARS = [
  { t: "Deal directly with the owner", d: "No middle man. Your property gets the principal's attention." },
  { t: "Numbers before opinions", d: "Free reports on value, rent and suburbs come first." },
  { t: "Trust account", d: "All client funds are held in a trust account." },
  { t: "REISA standards", d: "We operate under the REISA standards." },
];

/** Also emitted as FAQPage JSON-LD: plain, self-contained answers AI search engines can quote. */
const FAQS = [
  { q: "What real estate services does OziRealty offer in Adelaide?", a: "OziRealty is an owner-run Adelaide real estate agency offering property sales, property management, buyer's agent services, new homes, property investment, overseas investment, land, rentals and confidential business sales." },
  { q: "Who is the best real estate agent to contact in Adelaide?", a: "Look for an agent who shows the evidence behind their advice and whom you can deal with directly. At OziRealty you deal with the founder and principal, Esi Dor, and every recommendation comes with the comparable sales or data behind it." },
  { q: "How much does property management cost in Adelaide?", a: "Fees vary by agency and by what is included. OziRealty's property management in Adelaide starts from 2.99%, with four plans and the full fee schedule in writing before you sign." },
  { q: "Is a property appraisal in Adelaide free?", a: "With OziRealty, yes. The premium appraisal report is valued at $399, is free, and carries no obligation to list." },
  { q: "When do I pay a buyer's agent?", a: "With OziRealty's buyer's agent service, you pay after you settle on the property." },
  { q: "Can you help me buy a new home or house and land package in Adelaide?", a: "Yes. OziRealty's New Homes page lists house and land packages, townhouses and apartments across Adelaide, with prices shown." },
  { q: "Do you help investors outside South Australia?", a: "Yes. OziRealty helps with property investment in South Australia and overseas, including Dubai, and sells businesses confidentially Australia wide." },
  { q: "How do I know which service I need?", a: "Pick the option that describes you at the top of this page, or send the short form and we will point you to the right service. If you are still weighing up options, start with our free Strategy Services reports." },
  { q: "Is OziRealty a licensed real estate agency?", a: `Yes. OziRealty is a licensed real estate agency in South Australia (${AGENCY.licence}) and operates under the REISA standards.` },
];

export default function Page() {
  return (
    <>
      <AudiencePicker />
      <section className="sl-hero sl-hero--compact">
        <Image className="sl-hero-bg" src={photo("photo-1615873968403-89e068629265", 1600)} alt="" fill priority sizes="100vw" />
        <div className="wrap">
          <p className="eyebrow">Our services</p>
          <h1 className="display">
            Your property journey <em>starts here.</em>
          </h1>
          <p className="ss-lede">
            Selling, buying, renting, managing or investing: one Adelaide office, run by the
            business owner. Tell us who you are and we will show you where to start.
          </p>
          <div className="ps-who" role="group" aria-label="I am">
            <button type="button" data-aud="" aria-pressed="true">Show all</button>
            {AUDIENCES.map((a) => (
              <button type="button" key={a.key} data-aud={a.key} aria-pressed="false">
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <Fixed id="eight-services-one-office">
        <section className="sec" id="ps-services">
          <div className="wrap">
            <p className="eyebrow">What we do</p>
            <h2 className="display">
              Pick the one <em>that fits</em>
            </h2>
            <div className="ps-grid">
              {CARDS.map((c) => (
                <Link className={c.feat ? "ps-card ps-feat" : "ps-card"} data-aud={c.a} href={c.href} key={c.href}>
                  <span className="ps-aud">{c.aud}</span>
                  <h3>{c.t}</h3>
                  <p>
                    {c.pre}
                    <b>{c.hi}</b>
                    {c.post}
                  </p>
                  <span className="ps-go">{c.go} &rarr;</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </Fixed>

      <Fixed id="one-team-across-the-whole-journey">
        <section className="sec dark">
          <div className="wrap">
            <p className="eyebrow">How we work</p>
            <h2 className="display">
              One office, <em>run by the owner</em>
            </h2>
            <div className="ps-pillars">
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

      <Fixed id="finance">
        <section className="ba-loan">
          <div className="wrap ba-loan-in">
            <div>
              <p className="eyebrow">Buying or investing?</p>
              <h2 className="display">
                Know what you can borrow. <em>Free.</em>
              </h2>
              <p>
                Book a free chat with <b>Smart Loanz</b>, our associated broker, before you start
                looking.
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
              <p className="eyebrow">Not sure which one?</p>
              <h2 className="display">
                Tell us what you need, <em>we&rsquo;ll point the way</em>
              </h2>
              <p className="ss-for">One short form. It goes straight to the person who handles it.</p>
              <div className="sl-esi">
                <Image className="sl-ph" src={PORTRAIT.src} alt={PORTRAIT.alt} width={144} height={144} />
                <div>
                  <b>Esi Dor</b>
                  <span>Founder and principal</span>
                </div>
              </div>
              <p style={{ marginTop: 20 }}>
                <Link className="txtlink" href="/property-strategy-services">
                  Or start with Strategy Services <span aria-hidden="true">&rarr;</span>
                </Link>
              </p>
            </div>
            <div className="ss-form">
              <FormSection slug="property-services" bare />
            </div>
          </div>
        </section>
      </Fixed>

      <Fixed id="faq">
        <section className="sec" style={{ paddingTop: 0 }}>
          <div className="wrap" style={{ maxWidth: 820 }}>
            <h2 className="display">
              Real estate services in Adelaide: <em>common questions</em>
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
        <a className="btn" href="#enquire">Tell us what you need</a>
      </div>
    </>
  );
}

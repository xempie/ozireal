import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { FormSection } from "@/components/public/forms/form-section";
import { ContactTabs } from "@/components/public/contact-tabs";
import { AGENCY, PORTRAIT, REPORTS, photo } from "@/components/public/agency";
import { Fixed } from "@/components/public/fixed";

/**
 * Contact Us: the old /contact and /book-online merged (owner's request, 2026-11-02).
 *
 * The live site spells contact `/contact-adelaide-realestae-agency`; that and /book-online
 * both 301 here (next.config.ts), /book-online to #meeting so the meeting tab opens.
 *
 * The meeting form is a REQUEST, not a booking: nothing is held in the diary until the
 * office confirms, and the page says so. There is no calendar behind it yet (Phase 3).
 */

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Contact OziRealty in Prospect, Adelaide: call Esi Dor on 0422 271 293, send a message, or request a free one-on-one property consultation. 308 Prospect Rd, Prospect SA 5082.",
  alternates: { canonical: "/contact" },
};

const MAPS = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(AGENCY.office)}`;

/** Also emitted as FAQPage JSON-LD. */
const FAQS = [
  { q: "How do I contact a real estate agent in Prospect, Adelaide?", a: `Call Esi Dor on ${AGENCY.mobile}, the office on ${AGENCY.phone}, email ${AGENCY.email}, or visit OziRealty at ${AGENCY.office}.` },
  { q: "Is the property consultation really free?", a: "Yes. The one-on-one consultation with OziRealty's principal is free and carries no obligation." },
  { q: "Can we meet at my property or by video?", a: "Yes. Meetings can be at the office, at your property, by video call or by phone." },
  { q: "How quickly will I hear back?", a: "Messages go straight to Esi Dor. For the fastest answer, call." },
];

export default function Page() {
  return (
    <>
      <section className="sl-hero sl-hero--compact">
        <Image className="sl-hero-bg" src={photo("photo-1600596542815-ffad4c1539a9", 1600)} alt="" fill priority sizes="100vw" />
        <div className="wrap">
          <p className="eyebrow">Contact us</p>
          <h1 className="display">
            Talk to Esi, <em>directly.</em>
          </h1>
          <p className="ss-lede">
            Send a message or request a free one-on-one property consultation with{" "}
            {AGENCY.principal}, Principal of {AGENCY.name} ({AGENCY.licence}). No pressure, no
            queue.
          </p>
          <div className="ct-ways">
            <a className="ct-way ct-way--call" href={AGENCY.mobileHref}>
              <span className="ct-i" aria-hidden="true">📞</span>
              <span><b>Call Esi</b><small>{AGENCY.mobile}</small></span>
            </a>
            <a className="ct-way" href={AGENCY.phoneHref}>
              <span className="ct-i" aria-hidden="true">☎</span>
              <span><b>Office</b><small>{AGENCY.phone}</small></span>
            </a>
            <a className="ct-way" href={`mailto:${AGENCY.email}`}>
              <span className="ct-i" aria-hidden="true">✉</span>
              <span><b>Email</b><small>{AGENCY.email}</small></span>
            </a>
            <a className="ct-way" href="#visit">
              <span className="ct-i" aria-hidden="true">📍</span>
              <span><b>Visit</b><small>{AGENCY.office}</small></span>
            </a>
          </div>
        </div>
      </section>

      <Fixed id="form">
        <section className="sec sl-enq" id="enquire">
          <div className="wrap ss-pick-in">
            <div>
              <p className="eyebrow">Start here</p>
              <h2 className="display">
                How can we <em>help?</em>
              </h2>
              <p className="ss-for">
                A quick question, or a proper sit-down about your property. Pick one; both reach
                Esi.
              </p>
              <div className="sl-esi">
                <Image className="sl-ph" src={PORTRAIT.src} alt={PORTRAIT.alt} width={144} height={144} />
                <div>
                  <b>{AGENCY.principal}</b>
                  <span>Founder and principal, reads every message</span>
                </div>
              </div>
              <p className="eyebrow" style={{ marginTop: 26 }}>In a free consultation we cover</p>
              <ul className="ss-items ct-covers">
                {REPORTS.consultation.items.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
            <ContactTabs
              message={<FormSection slug="contact" bare />}
              meeting={<FormSection slug="book-online" bare />}
            />
          </div>
        </section>
      </Fixed>

      <Fixed id="visit">
        <section className="sec" id="visit">
          <div className="wrap">
            <p className="eyebrow">Visit the office</p>
            <h2 className="display">{AGENCY.office}</h2>
            <div className="ct-visit">
              <div className="ct-box">
                <h3>Meet where it suits you</h3>
                <p>At the office, at your property, or by video call.</p>
                <p>
                  Licence number: {AGENCY.licence} · ABN: {AGENCY.abn}
                </p>
                <p>
                  <a className="txtlink" href={MAPS} target="_blank" rel="noopener noreferrer">
                    Get directions <span aria-hidden="true">&rarr;</span>
                  </a>
                </p>
              </div>
              <div className="ct-box">
                <h3>About a valuation?</h3>
                <p>Request the {REPORTS.appraisal.title} instead. {REPORTS.appraisal.note}</p>
                <p>
                  <Link className="btn" href="/free-property-appraisal-sa">
                    Get my free report &rarr;
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </section>
      </Fixed>

      <Fixed id="faq">
        <section className="sec" style={{ paddingTop: 0 }}>
          <div className="wrap" style={{ maxWidth: 820 }}>
            <h2 className="display">
              Contacting OziRealty: <em>common questions</em>
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
        <a className="btn" href="#enquire">Send a message</a>
      </div>
    </>
  );
}

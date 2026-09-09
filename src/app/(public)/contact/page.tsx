import type { Metadata } from "next";
import Link from "next/link";
import { FormSection } from "@/components/public/forms/form-section";
import { PageHero } from "@/components/public/page-shell";
import { PrincipalCard } from "@/components/public/principal";
import { AGENCY, EMAILS, REPORTS } from "@/components/public/agency";

/**
 * Contact.
 *
 * The live site spells this `/contact-adelaide-realestae-agency`. Corrected here, with a
 * 301 from the old spelling in next.config.ts, per rule 6 of the redirect plan: fix the
 * typo on the new site, never drop the indexed URL.
 *
 * No enquiry form yet, on purpose. A form that takes a name and a phone number and stores
 * nothing is worse than a phone number that works, and the real one needs the
 * consent-provenance path described in free-property-appraisal-sa/page.tsx. Until then
 * this page gives people what they came for: how to reach the office, and which desk.
 */

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Speak directly with Esi Dor, Principal of OziRealty (RLA 350 628). Our office at 308 Prospect Rd, phone, and a direct email for each department.",
  alternates: { canonical: "/contact" },
};

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Contact us"
        title="Free property"
        titleEm="strategy consultation"
        lede={`Speak directly with ${AGENCY.principal}, Principal of ${AGENCY.name} (${AGENCY.licence}), and get clear guidance about your property.`}
        image="photo-1600596542815-ffad4c1539a9"
        imageAlt="White rendered home under a blue sky"
        facts={[AGENCY.licence, "No pressure", "One-on-one"]}
      />

      <section className="sec">
        <div className="wrap">
          <PrincipalCard />
        </div>
      </section>

      <section className="sec" style={{ background: "var(--paper-2)" }}>
        <div className="wrap page-cols">
          <div className="points">
            <h2 className="display">What we will cover</h2>
            <ul className="report">
              {[
                "Your property's current market value",
                "Rental income potential",
                "Selling strategies to maximise price",
                "Property management options",
              ].map((p, i) => (
                <li key={p}>
                  <em>{String(i + 1).padStart(2, "0")}</em> {p}
                </li>
              ))}
            </ul>
            <p className="prose" style={{ marginTop: 24 }}>
              <span style={{ color: "var(--muted)" }}>
                Whether you are planning to sell, invest, or need professional property
                management, this one-on-one session gives you practical insights based on
                the South Australian market. No pressure. Just clear, professional advice.
              </span>
            </p>
            <Link className="btn" href="/book-online" style={{ marginTop: 8 }}>
              Book your free consultation
            </Link>
          </div>

          <div className="contact-cols">
            <div className="contact-block">
              <h2>The office</h2>
              <p>{AGENCY.office}</p>
              <p>
                <a href={AGENCY.phoneHref}>{AGENCY.phone}</a>
              </p>
              <p>
                Licence Number: {AGENCY.licence}
                <br />
                ABN: {AGENCY.abn}
              </p>
            </div>

            {/*
              Five addresses, one per department, exactly as the live site lists them.
              Routing an enquiry to the right desk at the point of contact is cheaper than
              forwarding it afterwards.
            */}
            <div className="contact-block">
              <h2>Email the right desk</h2>
              <ul className="plain-list">
                {EMAILS.map((e) => (
                  <li key={e.address}>
                    {e.label}:{" "}
                    <a href={`mailto:${e.address}`}>{e.address}</a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="contact-block">
              <h2>Free reports</h2>
              <p>
                {REPORTS.appraisal.title}, {REPORTS.appraisal.note.toLowerCase()}
              </p>
              <Link className="txtlink" href="/free-property-appraisal-sa">
                Request the report <span aria-hidden="true">&rarr;</span>
              </Link>
            </div>

            <div className="contact-block">
              <h2>Looking to buy, sell or rent</h2>
              <p>
                Located at {AGENCY.office}, we provide personalised service tailored to
                your needs, whether you are a first-time buyer, an investor exploring
                overseas opportunities, or after expert advice on the local market.
              </p>
            </div>
          </div>
        </div>
      </section>
      <FormSection slug="contact" />
    </>
  );
}

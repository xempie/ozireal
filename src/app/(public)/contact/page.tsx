import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/public/page-shell";
import { AGENCY } from "@/components/public/site-chrome";
import { OPEN_HOMES } from "@/components/public/demo-data";

/**
 * Contact.
 *
 * The live site spells this `/contact-adelaide-realestae-agency`. Corrected here, with a
 * 301 from the old spelling in next.config.ts, per rule 6 of the redirect plan: fix the
 * typo on the new site, never drop the indexed URL.
 *
 * No enquiry form yet, on purpose. A form that collects a name and a phone number and
 * stores nothing is worse than a phone number that works, and the real one needs the
 * consent-provenance path described in free-property-appraisal-sa/page.tsx. Until then
 * this page gives people the two things they came for: how to reach the office and when.
 */

export const metadata: Metadata = {
  title: "Contact us",
  description:
    "Talk to Ozi Realty. Our office on Prospect Road, phone and email, inspection times, and where we are open this Saturday.",
  alternates: { canonical: "/contact" },
};

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Talk to someone who"
        titleEm="answers"
        lede="One office, and the people on the phone are the people who run the campaigns. Call during business hours and you will get an agent, not a queue."
        image="photo-1600596542815-ffad4c1539a9"
        imageAlt="White rendered home under a blue sky"
        facts={[AGENCY.licence, "Prospect and Glenelg"]}
      />

      <section className="sec">
        <div className="wrap contact-cols">
          <div className="contact-block">
            <h2>The office</h2>
            <p>{AGENCY.office}</p>
            <p>
              <a href={AGENCY.phoneHref}>{AGENCY.phone}</a>
              <br />
              <a href={`mailto:${AGENCY.email}`}>{AGENCY.email}</a>
            </p>
          </div>

          <div className="contact-block">
            <h2>Hours</h2>
            <p>Monday to Friday, 9:00 to 5:30</p>
            <p>Saturday, 9:00 to 1:00, and at every open home</p>
            <p>Inspections run most Saturdays between 10:00 and 12:00.</p>
          </div>

          <div className="contact-block">
            <h2>Open this Saturday</h2>
            <ul className="plain-list">
              {OPEN_HOMES.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </div>

          <div className="contact-block">
            <h2>Selling or renting out</h2>
            <p>
              The fastest way to start is an appraisal. It is free, it takes about forty
              minutes at the property, and there is no listing pitch attached to it.
            </p>
            <Link className="btn" href="/free-property-appraisal-sa">
              Book a free appraisal
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

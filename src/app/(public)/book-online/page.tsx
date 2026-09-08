import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/public/page-shell";
import { PrincipalCard } from "@/components/public/principal";
import { AGENCY, EMAILS, REPORTS } from "@/components/public/agency";

/**
 * Free meeting.
 *
 * ## Read this before cutover. It is the one page that can lose real revenue.
 *
 * `/book-online` on the live site is **Wix Bookings**, and it takes real appointments
 * today. `docs/legacy-site.md` flags it as the migration's sharpest risk: Phase 2B does
 * not build public booking, Phase 3 builds the calendar (3.1, 3.7), and in between there
 * is nothing to receive a booking.
 *
 * So this page has no booking widget, and it must not grow a fake one. A form that takes
 * a name, a date and a phone number and drops them is worse than no page at all, because
 * the visitor leaves believing an appointment exists.
 *
 * Two acceptable outcomes at cutover, and they are a decision for the business, not for
 * this file:
 *
 *   1. `/book-online` keeps pointing at Wix Bookings until Phase 3 lands, or
 *   2. Phase 2B ships a real booking form writing to `calendar_events`, with consent
 *      provenance captured the same way the appraisal form will capture it.
 *
 * Until one of those happens, this page routes people to the phone, which works.
 */

export const metadata: Metadata = {
  title: "Free Meeting",
  description:
    "Book a one-on-one real estate consultation with Esi Dor, Principal of OziRealty (RLA 350 628). Expert property advice, no pressure and no obligation.",
  alternates: { canonical: "/book-online" },
};

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Free meeting"
        title={`Expert property advice with`}
        titleEm={AGENCY.principal}
        lede={`Book a one-on-one real estate consultation with ${AGENCY.principal}, Principal of ${AGENCY.name} (Licence Number: ${AGENCY.licence}).`}
        image="photo-1600210491892-03d54c0aaf87"
        imageAlt="Apartment living room with a fireplace"
        facts={["Free", "One-on-one", "No obligation"]}
      />

      <section className="sec">
        <div className="wrap">
          <PrincipalCard />
        </div>
      </section>

      <section className="sec" style={{ background: "var(--paper-2)" }}>
        <div className="wrap page-cols">
          <div className="points">
            <h2 className="display">{REPORTS.consultation.title}</h2>
            <ul className="report">
              {REPORTS.consultation.items.map((p, i) => (
                <li key={p}>
                  <em>{String(i + 1).padStart(2, "0")}</em> {p}
                </li>
              ))}
            </ul>
          </div>

          <div className="contact-cols">
            <div className="contact-block">
              <h2>Book by phone</h2>
              <p>
                The fastest way to get a time in the diary. Call during business hours and
                you will speak to the principal rather than a queue.
              </p>
              <p>
                <a href={AGENCY.phoneHref}>{AGENCY.phone}</a>
              </p>
            </div>

            <div className="contact-block">
              <h2>Or email</h2>
              <ul className="plain-list">
                {EMAILS.map((e) => (
                  <li key={e.address}>
                    {e.label}: <a href={`mailto:${e.address}`}>{e.address}</a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="contact-block">
              <h2>Where</h2>
              <p>{AGENCY.office}</p>
              <p>
                At the office, at the property, or by video call if that suits you better.
              </p>
            </div>

            <div className="contact-block">
              <h2>If it is about a valuation</h2>
              <p>
                Request the premium appraisal report instead. {REPORTS.appraisal.note}
              </p>
              <Link className="btn" href="/free-property-appraisal-sa">
                Get my free report
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { FormSection } from "@/components/public/forms/form-section";
import { PageHero } from "@/components/public/page-shell";
import { PrincipalCard } from "@/components/public/principal";
import { AGENCY, EMAILS, REPORTS } from "@/components/public/agency";

import { Fixed } from "@/components/public/fixed";
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
 * So the form on this page is a REQUEST, not a booking, and the difference is load
 * bearing. It captures what the meeting is about and when generally suits, lands in the
 * CRM like every other enquiry, and says plainly that nothing is held in the diary until
 * the office replies. What it must never do is show a calendar of times and let somebody
 * pick one: that reads as a confirmed appointment, and there is nothing behind it to
 * confirm against.
 *
 * Two acceptable outcomes at cutover, and they are a decision for the business:
 *
 *   1. `/book-online` keeps pointing at Wix Bookings until Phase 3 lands, or
 *   2. Phase 3's calendar (3.1, 3.7) backs a real booking that writes `calendar_events`,
 *      at which point this form becomes the fallback rather than the whole path.
 *
 * Either way the phone number stays on the page, because it is the only route that
 * confirms a time in one step today.
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

      <Fixed id="form">
        <FormSection slug="book-online" />
      </Fixed>

      <Fixed id="principal">
        <section className="sec">
          <div className="wrap">
            <PrincipalCard />
          </div>
        </section>
      </Fixed>

      <Fixed id="what-we-cover">
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
      </Fixed>

    </>
  );
}

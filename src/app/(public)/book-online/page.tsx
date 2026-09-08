import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/public/page-shell";
import { AGENCY } from "@/components/public/site-chrome";

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
 * So this page does not have a booking widget, and it must not grow a fake one. A form
 * that takes a name, a date and a phone number and drops them is worse than no page at
 * all, because the visitor leaves believing an appointment exists.
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
  title: "Book a free meeting",
  description:
    "Book a free, no obligation meeting with an Ozi Realty agent about selling, renting out, buying or property strategy in Adelaide.",
  alternates: { canonical: "/book-online" },
};

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Free meeting"
        title="Half an hour,"
        titleEm="no obligation"
        lede="Bring a question about a property, a street or a decision you are weighing. There is nothing to sign and no listing pitch at the end of it."
        image="photo-1600210491892-03d54c0aaf87"
        imageAlt="Apartment living room with a fireplace"
        facts={["Free", "About 30 minutes", "In the office or at the property"]}
      />

      <section className="sec">
        <div className="wrap contact-cols">
          <div className="contact-block">
            <h2>Call the office</h2>
            <p>
              The fastest way to get a time in the diary. Ring during business hours and
              you will speak to an agent rather than a queue.
            </p>
            <p>
              <a href={AGENCY.phoneHref}>{AGENCY.phone}</a>
              <br />
              <a href={`mailto:${AGENCY.email}`}>{AGENCY.email}</a>
            </p>
          </div>

          <div className="contact-block">
            <h2>When we are available</h2>
            <p>Monday to Friday, 9:00 to 5:30</p>
            <p>Saturday, 9:00 to 1:00</p>
            <p>
              Evening appointments are usually possible with a few days notice. Say so
              when you call.
            </p>
          </div>

          <div className="contact-block">
            <h2>What to bring</h2>
            <p>
              Nothing at all is fine. If the meeting is about a specific property, the
              address is enough for us to have the sales history and the comparables in
              front of us before you arrive.
            </p>
          </div>

          <div className="contact-block">
            <h2>If it is about a valuation</h2>
            <p>
              Book the appraisal instead. It happens at the property, takes about forty
              minutes, and you get a written report rather than a conversation.
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

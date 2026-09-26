import type { Metadata } from "next";
import Link from "next/link";
import { FormSection } from "@/components/public/forms/form-section";
import { PageHero } from "@/components/public/page-shell";
import { ServiceGrid } from "@/components/public/service-grid";
import { REPORTS } from "@/components/public/agency";

/**
 * Our services.
 *
 * `/property-services` mirrors the live Wix page, "Services" in the site menu.
 *
 * Bespoke rather than a `ServicePageBody`, because the shared points-and-prose layout was
 * the wrong shape for this page. Its whole job is to get somebody to the right service,
 * and a wall of text makes that harder than a grid of eight labelled cards does. Every
 * card lands on a page carrying that service's enquiry form, so the path from "I want to
 * sell" to a lead in the CRM is two clicks.
 */

export const metadata: Metadata = {
  title: "Our Services",
  description:
    "Selling, property management from 2.99%, renting, buyer advocacy, investment, land, and business sales. Adelaide expertise combined with global insight.",
  alternates: { canonical: "/property-services" },
};

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Our services"
        title="Your property journey"
        titleEm="starts here"
        lede="From finding your first home to selling, investing, or managing property, we make every step simple, clear, and stress-free."
        image="photo-1615873968403-89e068629265"
        imageAlt="Living room with a tan leather sofa against a dark green wall"
        facts={["Local and global", "Transparent fees", "RLA 350 628"]}
      />

      <FormSection slug="property-services" />

      <section className="sec">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <p className="eyebrow">What we do</p>
              <h2 className="display">
                Eight services, <em>one office</em>
              </h2>
            </div>
            <p className="lede" style={{ margin: 0 }}>
              Pick the one that fits and tell us about it. Each goes straight to the
              person who handles it.
            </p>
          </div>

          <ServiceGrid />
        </div>
      </section>

      <section className="sec dark">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <p className="eyebrow">Free reports</p>
              <h2 className="display">
                Start with the <em>numbers</em>
              </h2>
            </div>
            <p className="lede" style={{ margin: 0 }}>
              {REPORTS.appraisal.note}
            </p>
          </div>

          <div className="report-grid">
            {[REPORTS.appraisal, REPORTS.suburb, REPORTS.rental].map((r) => (
              <div className="report-card" key={r.title}>
                <h3>{r.title}</h3>
                <ul>
                  {r.items.slice(0, 6).map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="report-cta">
            <Link className="btn" href="/free-property-appraisal-sa">
              Get my free appraisal
            </Link>
            <Link className="txtlink" href="/free-suburb-insight-report">
              Free suburb insight report <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="sec" style={{ background: "var(--paper-2)" }}>
        <div className="wrap page-cols">
          <div className="prose-stack">
            <div className="prose">
              <h2>One team across the whole journey</h2>
              <p>
                Our dedicated team combines local market expertise with global insights to
                guide you through every stage of your property journey. With a commitment
                to transparency, results, and long-term value, we are here to help you
                make smarter, more confident real estate decisions.
              </p>
            </div>
          </div>
          <div className="prose-stack">
            <div className="prose">
              <h2>Property and finance together</h2>
              <p>
                OziRealty blends real estate expertise with financial advising and finance
                broking, providing seamless property and investment solutions. That
                combination is unusual in a local agency, and it is why a strategy
                conversation here can cover the finance as well as the property.
              </p>
              <p>
                <Link className="txtlink" href="/property-strategy-services">
                  Property strategy services <span aria-hidden="true">&rarr;</span>
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

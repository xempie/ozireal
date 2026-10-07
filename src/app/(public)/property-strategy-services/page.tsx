import type { Metadata } from "next";
import Link from "next/link";
import { FormSection } from "@/components/public/forms/form-section";
import { PageHero } from "@/components/public/page-shell";
import { servicePageBySlug } from "@/components/public/site-pages";
import { REPORTS } from "@/components/public/agency";

import { Fixed } from "@/components/public/fixed";
/**
 * "Strategy Services", mirroring www.ozirealty.com.au/property-strategy-services
 * (copied 2026-10-04): the heading, the introduction, and the four free offers, each
 * card linking to its own form page, exactly as the live site does:
 *
 *   Free Premium Appraisal Report  -> /free-property-appraisal-sa
 *   Free Property Consultation     -> /book-online
 *   Free Suburb Insight Report     -> /free-suburb-insight-report
 *   Property Rental Report         -> /property-rental-report
 *
 * The live page has no form of its own; the cards ARE its calls to action, so they come
 * straight after the hero. The strategy enquiry form stays at the end for anyone whose
 * question fits none of the four.
 */

const page = servicePageBySlug("property-strategy-services")!;

export const metadata: Metadata = {
  title: page.metaTitle,
  description: page.metaDescription,
  alternates: { canonical: "/property-strategy-services" },
};

const OFFERS = [
  {
    tag: "Limited offer · valued at $399",
    title: REPORTS.appraisal.title,
    items: ["No obligation, no pressure", ...REPORTS.appraisal.items],
    href: "/free-property-appraisal-sa",
    cta: "Get my free appraisal",
  },
  {
    tag: "One-on-one with the principal",
    title: "Free Property Consultation",
    items: [...REPORTS.consultation.items],
    href: "/book-online",
    cta: "Free consultation",
  },
  {
    tag: "Stay ahead of the next market shift",
    title: REPORTS.suburb.title,
    items: [...REPORTS.suburb.items],
    href: "/free-suburb-insight-report",
    cta: "Unlock my suburb insights",
  },
  {
    tag: "Smart rent, stable income, zero guesswork",
    title: REPORTS.rental.title,
    items: [...REPORTS.rental.items],
    href: "/property-rental-report",
    cta: "Get rent report now",
  },
];

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Strategy services"
        title="Turn property into a strategy,"
        titleEm="not a guess"
        lede="Making the right property decisions isn't about luck. It's about having a clear strategy based on real data, market insight, and long-term goals."
        image={page.image}
        imageAlt={page.imageAlt}
        facts={["Investors", "Homeowners", "Landlords"]}
      />

      <Fixed id="intro">
        <section className="sec">
          <div className="wrap">
            <div className="prose" style={{ maxWidth: "64ch" }}>
              <p>
                We provide property strategy services for investors, homeowners and landlords:
                reducing risk, increasing returns, and making every move count. Start with
                whichever of these free reports fits the question you are weighing.
              </p>
            </div>
          </div>
        </section>
      </Fixed>

      <Fixed id="four-ways-to-start">
        <section className="sec dark">
          <div className="wrap">
            <div className="sec-head">
              <div>
                <p className="eyebrow">Free, no obligation</p>
                <h2 className="display">
                  Four ways to <em>start</em>
                </h2>
              </div>
            </div>

            <div className="report-grid report-grid--2">
              {OFFERS.map((o) => (
                <div className="report-card report-card--offer" key={o.href}>
                  <p className="report-tag">{o.tag}</p>
                  <h3>{o.title}</h3>
                  <ul>
                    {o.items.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                  <Link className="btn report-go" href={o.href}>
                    {o.cta}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      </Fixed>

      <Fixed id="form">
        <FormSection slug="property-strategy-services" />
      </Fixed>
    </>
  );
}

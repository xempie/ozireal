import type { Metadata } from "next";
import { FormSection } from "@/components/public/forms/form-section";
import { PageHero, CtaBand } from "@/components/public/page-shell";
import { REPORTS } from "@/components/public/agency";

import { Fixed } from "@/components/public/fixed";
/**
 * The suburb insight report.
 *
 * `/free-suburb-insight-report` mirrors the live Wix page, one of the two lead forms on
 * the current site.
 *
 * ## What this page deliberately does not show
 *
 * It used to render three suburb cards carrying medians, twelve-month movement and days
 * on market for Prospect, Norwood and Glenelg. Every one of those figures was invented by
 * the design template. Publishing market statistics an agency cannot source is a
 * misleading representation, and it is worse here than elsewhere because the whole point
 * of the page is that the numbers are trustworthy.
 *
 * Real medians mean a data licence (RP Data, PropTrack) or deriving them from settled
 * listings once there are enough. Until one of those exists, the page describes what the
 * report contains rather than previewing numbers it cannot stand behind.
 */

export const metadata: Metadata = {
  title: "Free Suburb Insight Report",
  description:
    "Stay ahead of the next market shift. Median prices, rental yields, vacancy rates, growth performance, demand levels and school catchments for your suburb.",
  alternates: { canonical: "/free-suburb-insight-report" },
};

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Suburb insight"
        title="Stay ahead of the"
        titleEm="next market shift"
        lede="A written report on the suburb you are asking about, covering what the market is doing now and what it has done over the past several years."
        image="photo-1568605114967-8130f3a36994"
        imageAlt="Character home in Prospect"
        facts={["Free", "No obligation", "South Australia"]}
      />

      <Fixed id="form">
        <FormSection slug="free-suburb-insight-report" />
      </Fixed>

      <Fixed id="whats-in-it">
        <section className="sec">
          <div className="wrap">
            <div className="sec-head">
              <div>
                <p className="eyebrow">What is in it</p>
                <h2 className="display">
                  {REPORTS.suburb.title.replace("Free ", "")}
                </h2>
              </div>
              <p className="lede" style={{ margin: 0 }}>
                {REPORTS.suburb.note}
              </p>
            </div>

            <ul className="insight-grid">
              {REPORTS.suburb.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </div>
        </section>
      </Fixed>

      <Fixed id="also-available">
        <section className="sec" style={{ background: "var(--paper-2)" }}>
          <div className="wrap page-cols">
            <div className="points">
              <h2 className="display">Also available</h2>
              <ul className="report">
                <li>
                  <em>01</em> {REPORTS.appraisal.title}, {REPORTS.appraisal.note.toLowerCase()}
                </li>
                <li>
                  <em>02</em> {REPORTS.rental.title}, for weekly rent and yield
                </li>
                <li>
                  <em>03</em> {REPORTS.consultation.title}, one-on-one with the principal
                </li>
              </ul>
            </div>

            <div className="prose-stack">
              <div className="prose">
                <h2>Why not an automated estimate</h2>
                <p>
                  An automated valuation reads sale prices and square metres. It cannot see
                  that one side of a street backs onto a main road, that a block is deep
                  enough to subdivide, or that the house two doors down sold badly because
                  of a deadline rather than the market.
                </p>
                <p>
                  Those are the things that move a price by six figures, and they are why
                  the report is written by somebody who knows the area rather than generated
                  from a postcode.
                </p>
              </div>
            </div>
          </div>
        </section>
      </Fixed>


      <Fixed id="closing-cta">
        <CtaBand
          heading="Unlock my"
          headingEm="suburb insights"
          label="Request the report"
          href="/contact"
        />
      </Fixed>
    </>
  );
}

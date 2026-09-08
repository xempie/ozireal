import type { Metadata } from "next";
import Image from "next/image";
import { PageHero, Points, CtaBand } from "@/components/public/page-shell";
import { SUBURB_CARDS, photo } from "@/components/public/demo-data";

/**
 * Suburb reports.
 *
 * `/free-suburb-insight-report` mirrors the live Wix page. It is a lead form there, and
 * the nav's "Suburbs" item points here because it is the closest existing equivalent.
 *
 * The medians on the cards are invented, like the ticker they came from. Real figures
 * mean a data licence (RP Data or PropTrack) or deriving them from settled listings once
 * there are enough, and publishing a median an agency cannot substantiate is the same
 * problem as publishing a sales statistic it did not achieve.
 */

export const metadata: Metadata = {
  title: "Suburb reports",
  description:
    "What a suburb is actually doing: median, twelve month movement, days on market, and the streets within it that behave differently from the average.",
  alternates: { canonical: "/free-suburb-insight-report" },
};

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Suburb reports"
        title="Know the suburb,"
        titleEm="then the street"
        lede="A suburb median tells you very little about one street inside it. The report is written for the street you are actually asking about."
        image="photo-1568605114967-8130f3a36994"
        imageAlt="Character home in Prospect"
        facts={["Free", "No obligation", "Written, not automated"]}
      />

      <section className="sec">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <p className="eyebrow">Where we work</p>
              <h2 className="display">
                Three suburbs we <em>know cold</em>
              </h2>
            </div>
          </div>

          <div className="suburbs">
            {SUBURB_CARDS.map((s) => (
              <article className="sub" key={s.name}>
                <Image
                  src={photo(s.img, 900)}
                  alt={s.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1080px) 50vw, 33vw"
                  style={{ objectFit: "cover" }}
                />
                <div className="sub-body">
                  <h3>{s.name}</h3>
                  <p className="m">{s.meta}</p>
                  <div className="sub-stats">
                    <div>
                      <span>Median</span>
                      <b>{s.median}</b>
                    </div>
                    <div>
                      <span>12 mth</span>
                      <b className="up">{s.move}</b>
                    </div>
                    <div>
                      <span>Days</span>
                      <b>{s.days}</b>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="sec" style={{ background: "var(--paper-2)" }}>
        <div className="wrap page-cols">
          <Points
            title="What the report covers"
            items={[
              "The median and the twelve month movement, with the sale count behind it",
              "Days on market, and whether that is trending up or down",
              "The streets inside the suburb that consistently beat the average, and why",
              "What is listed right now, and what we expect to come up next quarter",
            ]}
          />
          <div className="prose-stack">
            <div className="prose">
              <h2>Why not an automated estimate</h2>
              <p>
                An automated valuation reads sale prices and square metres. It cannot see
                that one side of a street backs onto a main road, that a block is deep
                enough to subdivide, or that the house two doors down sold badly because
                of a probate deadline.
              </p>
              <p>
                Those are the things that move a price by six figures, and they are why
                the report is written by somebody who has walked it.
              </p>
            </div>
          </div>
        </div>
      </section>

      <CtaBand
        heading="Ask about your street"
        label="Request a suburb report"
        href="/contact"
      />
    </>
  );
}

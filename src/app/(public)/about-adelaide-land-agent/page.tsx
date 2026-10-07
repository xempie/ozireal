import type { Metadata } from "next";
import { PageHero, Prose, CtaBand } from "@/components/public/page-shell";
import { PrincipalCard } from "@/components/public/principal";
import { ABOUT, AGENCY } from "@/components/public/agency";

import { Fixed } from "@/components/public/fixed";
/**
 * About.
 *
 * `/about-adelaide-land-agent` mirrors the live Wix page, "About" in the site menu.
 *
 * Bespoke rather than a `ServicePageBody`, because this is the page whose whole point is
 * who runs the agency. It carries the principal's photograph, which the site went several
 * rounds without: it named three agents who do not exist and never showed the person who
 * actually holds RLA 350 628.
 */

export const metadata: Metadata = {
  title: "About Us",
  description:
    "OziRealty is an Adelaide real estate agency led by Esi Dor, Founder and CEO. Residential sales, property management and investment, blending real estate with financial advising and finance broking.",
  alternates: { canonical: "/about-adelaide-land-agent" },
};

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="About us"
        title="Where property"
        titleEm="meets purpose"
        lede="More than a real estate agency. Based in Adelaide, South Australia, we specialise in residential sales, property management, and investment opportunities across the state and beyond."
        image="photo-1568605114967-8130f3a36994"
        imageAlt="Character home in Prospect"
        facts={[AGENCY.licence, AGENCY.office, `ABN ${AGENCY.abn}`]}
      />

      <Fixed id="the-person-you-will-actually-deal-with">
        <section className="sec">
          <div className="wrap">
            <div className="sec-head">
              <div>
                <p className="eyebrow">Meet the board</p>
                <h2 className="display">
                  The person you will <em>actually deal with</em>
                </h2>
              </div>
            </div>

            <PrincipalCard cta={{ label: "Book a free consultation", href: "/book-online" }}>
              <p>
                Esi leads OziRealty and holds the agency&rsquo;s licence. When the site says
                there is no middle man between you and the principal, this is who it means.
              </p>
            </PrincipalCard>
          </div>
        </section>
      </Fixed>

      <Fixed id="mission">
        <section className="sec" style={{ background: "var(--paper-2)" }}>
          <div className="wrap page-cols">
            <div className="prose-stack">
              <Prose heading="Mission" body={[ABOUT.mission]} />
              <Prose heading="Vision" body={[ABOUT.vision]} />
            </div>
            <div className="prose-stack">
              <Prose heading="How we work" body={[...ABOUT.body]} />
            </div>
          </div>
        </section>
      </Fixed>

      <Fixed id="what-the-agency-runs-on">
        <section className="sec">
          <div className="wrap">
            <div className="sec-head">
              <div>
                <p className="eyebrow">Values</p>
                <h2 className="display">
                  What the agency <em>runs on</em>
                </h2>
              </div>
            </div>

            <div className="why-grid">
              {ABOUT.values.map((v) => (
                <div className="why-card" key={v.name}>
                  <h3>{v.name}</h3>
                  <ul>
                    <li>{v.body}</li>
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      </Fixed>

      <Fixed id="closing-cta">
        <CtaBand
          heading="Your property journey"
          headingEm="starts here."
          label="Talk to Esi"
          href="/contact"
        />
      </Fixed>
    </>
  );
}

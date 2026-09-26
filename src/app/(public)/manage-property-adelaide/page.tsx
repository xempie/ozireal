import type { Metadata } from "next";
import { FormSection } from "@/components/public/forms/form-section";
import { PageHero, Points, CtaBand } from "@/components/public/page-shell";
import { MANAGEMENT_PLANS, REPORTS } from "@/components/public/agency";

/**
 * Property management.
 *
 * `/manage-property-adelaide` mirrors the live Wix page, "Manage My Property" in the
 * site's services row. Note that `/rent-out-my-property-adelaide` and
 * `/property-rental-report` also market management on the current site; both should 301
 * here unless they are rebuilt separately.
 *
 * Bespoke rather than a `ServicePageBody`, because this is the one page with a tier
 * comparison on it and three plans do not fit the shared points-and-prose layout.
 *
 * Every claim here is the live site's: 2.99%, 100 days risk-free, no middle man, two
 * months free on signing and another two on a referral, and the plan contents. They are
 * commercial terms rather than performance figures, which is what makes them publishable
 * without substantiation of past results, and they still need the licensee to confirm
 * they are current before cutover.
 */

export const metadata: Metadata = {
  title: "Property Management From 2.99%",
  description:
    "Adelaide property management from 2.99% with 100 days risk-free. Proactive management, careful tenant selection, and rental strategy based on current South Australian market data.",
  alternates: { canonical: "/manage-property-adelaide" },
};

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Property management"
        title="More care,"
        titleEm="less cost"
        lede="Flexible property management plans designed to protect your rental income, reduce risks, and maximise long-term returns."
        image="photo-1605146769289-440113cc3d00"
        imageAlt="Grey and white contemporary home"
        facts={["From 2.99%", "100 days risk-free", "No middle man"]}
      />

      <FormSection slug="manage-property-adelaide" />

      <section className="sec">
        <div className="wrap page-cols">
          <Points
            title="What the service includes"
            items={[
              "Strategic rent pricing and market monitoring",
              "Careful tenant screening and leasing management",
              "Routine inspections and maintenance coordination",
              "Fast response to tenant issues and compliance matters",
              "Direct communication with your dedicated property manager",
            ]}
          />
          <div className="prose-stack">
            <div className="prose">
              <h2>Designed to maximise your investment</h2>
              <p>
                Our approach focuses on proactive management, careful tenant selection, and
                smart rental strategies based on current market data across South
                Australia.
              </p>
              <p>
                With transparent fees, clear communication, and professional oversight,
                landlords always know how their property is performing. Whether you own one
                property or a growing portfolio, the goal is simple: protect your asset,
                optimise your income, and make property ownership easier.
              </p>
            </div>
            <div className="prose">
              <h2>Bring a friend</h2>
              <p>
                On all packages, refer another landlord who signs with us and you both earn
                two months of management fee-free.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="sec dark">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <p className="eyebrow">Plans</p>
              <h2 className="display">
                Three ways to <em>manage it</em>
              </h2>
            </div>
            <p className="lede" style={{ margin: 0 }}>
              Each plan builds on the one before it. Ask for the full fee schedule in
              writing before you sign anything, here or anywhere else.
            </p>
          </div>

          <div className="report-grid">
            {MANAGEMENT_PLANS.map((plan) => (
              <div className="report-card" key={plan.name}>
                <h3>{plan.name}</h3>
                <ul>
                  {plan.points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sec" style={{ background: "var(--paper-2)" }}>
        <div className="wrap page-cols">
          <Points title={REPORTS.rental.title} items={[...REPORTS.rental.items]} />
          <div className="prose-stack">
            <div className="prose">
              <h2>Smart rent, stable income, zero guesswork</h2>
              <p>
                Before you set a rent, it is worth knowing what comparable properties
                actually leased for, how long they sat vacant, and what tenant profile the
                property attracts. The rental report covers all of it.
              </p>
              <p>
                Pricing a rental too high costs more in vacancy than the extra rent
                recovers. That is the calculation the report is there to settle.
              </p>
            </div>
          </div>
        </div>
      </section>


      <CtaBand
        heading="Get your"
        headingEm="rent report"
        label="Talk to the office"
        href="/contact"
      />
    </>
  );
}

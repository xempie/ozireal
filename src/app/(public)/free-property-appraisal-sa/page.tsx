import type { Metadata } from "next";
import Image from "next/image";
import { PageHero } from "@/components/public/page-shell";
import { DemoAppraisalForm } from "@/components/public/demo-appraisal-form";
import { photo } from "@/components/public/agency";

/**
 * The appraisal request.
 *
 * `/free-property-appraisal-sa` mirrors the live Wix page, which is one of the two lead
 * forms on the current site and therefore one of the URLs it would hurt most to break.
 *
 * The form is still the preview island: it discloses that it stores nothing, above the
 * fields rather than after them. Wiring it up means fetching a signed token and the exact
 * consent wording from `/api/forms/[key]`, posting through the Phase 1 web adapter, and
 * storing that wording with the enquiry as consent provenance. That is a real endpoint
 * with a legal reason to exist, not a fetch bolted onto a component.
 */

export const metadata: Metadata = {
  title: "Free property appraisal",
  description:
    "A written appraisal of your Adelaide property within 48 hours. A price range with the comparable sales behind it, buyer demand for your street, and no listing pitch.",
  alternates: { canonical: "/free-property-appraisal-sa" },
};

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Appraisal"
        title="What is your home"
        titleEm="actually worth?"
        lede="Not an automated estimate. One of our agents walks through, then writes you a report you could hand to your accountant."
        image="photo-1598928506311-c55ded91a20c"
        imageAlt="Living room with a marble fireplace"
        facts={["48 hour turnaround", "No obligation", "No listing pitch"]}
      />

      <section className="sec">
        <div className="wrap appraise">
          <figure className="appraise-fig">
            <Image
              src={photo("photo-1615873968403-89e068629265", 1000)}
              alt="Living room with a tan leather sofa against a dark green wall"
              fill
              sizes="(max-width: 1080px) 100vw, 40vw"
              style={{ objectFit: "cover" }}
            />
            <div className="appraise-badge">
              Turnaround<b>48 hours</b>
            </div>
          </figure>

          <div>
            <p className="eyebrow">What you get</p>
            <h2 className="display">
              A report, not a <em>number</em>
            </h2>

            <ul className="report">
              <li>
                <em>01</em> A price range, with the six comparable sales it came from
              </li>
              <li>
                <em>02</em> Buyer demand for your street over the past ninety days
              </li>
              <li>
                <em>03</em> Rental yield, if you would rather hold than sell
              </li>
              <li>
                <em>04</em> The three jobs worth doing before you list, and what they
                return
              </li>
            </ul>

            <DemoAppraisalForm />
          </div>
        </div>
      </section>
    </>
  );
}

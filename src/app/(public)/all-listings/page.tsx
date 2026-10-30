import type { Metadata } from "next";
import Link from "next/link";
import { PageHero, CtaBand } from "@/components/public/page-shell";
import { ListingsGrid } from "@/components/public/listings-grid";
import { toCard } from "@/components/public/listing-cards";
import { onMarket } from "@/server/public/listings";
import { Fixed } from "@/components/public/fixed";

/**
 * Every advertised listing, sale and lease together. At /all-listings because /listings
 * is the CRM's own route (route groups cannot share a path).
 *
 * The home page's "Every listing" link used to land on /for-sale, which filters to sales,
 * so with only lease stock live it showed next to nothing. This page is what that link
 * means (owner's request, 2026-10-31). Straight after the hero, a strong band sends
 * buyers to the new-home projects, which are not listings and so are not in this grid.
 */

export const metadata: Metadata = {
  title: "Every listing: homes for sale and lease in Adelaide",
  description:
    "Every property Ozi Realty is advertising for sale or lease across Adelaide, plus new-home projects and buying opportunities.",
  alternates: { canonical: "/all-listings" },
};

export default async function Page() {
  const listed = (await onMarket(60)).map(toCard);

  return (
    <>
      <PageHero
        eyebrow="Every listing"
        title="For sale and lease,"
        titleEm="all in one place"
        lede="Every property we are advertising right now, whether you are buying or renting."
        image="photo-1570129477492-45c003edd2be"
        imageAlt="Sandstone villa with a return verandah"
        facts={["Adelaide and South Australia", "Sale and lease"]}
      />

      <Fixed id="projects-cta">
        <section className="listings-projects">
          <div className="wrap listings-projects-inner">
            <div>
              <p className="eyebrow">New homes &amp; projects</p>
              <h2 className="display">
                Looking for something <em>brand new?</em>
              </h2>
              <p className="listings-projects-lede">
                House and land, townhouses and apartments across Adelaide and beyond, with
                prices, grants and build timelines on every project.
              </p>
            </div>
            <Link className="btn listings-projects-btn" href="/projects-and-opportunities">
              See projects &amp; opportunities <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        </section>
      </Fixed>

      <Fixed id="listings">
        <section className="sec" id="listings">
          <div className="wrap">
            <ListingsGrid
              items={listed}
              empty={
                <p className="lede">
                  Nothing is advertised right now. We usually know what is coming, so talk to
                  the office.
                </p>
              }
            />
          </div>
        </section>
      </Fixed>

      <Fixed id="closing-cta">
        <CtaBand
          heading="Not seeing it? We usually know what is"
          headingEm="coming."
          label="Talk to the office"
          href="/contact"
        />
      </Fixed>
    </>
  );
}

import type { Metadata } from "next";
import { PageHero, CtaBand } from "@/components/public/page-shell";
import { DemoListings } from "@/components/public/demo-listings";
import { DEMO_LISTINGS } from "@/components/public/demo-data";

/**
 * Homes for sale.
 *
 * A new URL rather than a mirrored one. The live Wix site has no for-sale search page,
 * only four `/properties/<slug>` pages, so there is no ranking to preserve here and the
 * slug scheme from CLAUDE.md 16 applies instead.
 *
 * Renders demo data, like everything else on the site until the content is signed off.
 * When it is wired up this reads `searchListings()` from `src/server/public/listings.ts`
 * with its filters in the URL, which is what makes a result set linkable and crawlable.
 */

export const metadata: Metadata = {
  title: "Homes for sale in Adelaide",
  description:
    "Houses, units and townhouses for sale across Adelaide, from Prospect to the sea. Inspection times, auction dates and the agent to call.",
  alternates: { canonical: "/for-sale" },
};

export default function Page() {
  const forSale = DEMO_LISTINGS.filter((l) => l.cat !== "lease");

  return (
    <>
      <PageHero
        eyebrow="For sale"
        title="On the market"
        titleEm="right now"
        lede="Every property we are advertising for sale, with the inspection times and the agent who has walked the street."
        image="photo-1570129477492-45c003edd2be"
        imageAlt="Sandstone villa with a return verandah"
        facts={["Prospect and Glenelg", "Auction or private treaty"]}
      />

      <section className="sec" id="listings">
        <div className="wrap">
          <DemoListings items={forSale} />
        </div>
      </section>

      <CtaBand
        heading="Not seeing it? We usually know what is"
        headingEm="coming."
        label="Talk to the office"
        href="/contact"
      />
    </>
  );
}

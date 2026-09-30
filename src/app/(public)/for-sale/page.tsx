import type { Metadata } from "next";
import { PageHero, CtaBand } from "@/components/public/page-shell";
import { ListingsGrid } from "@/components/public/listings-grid";
import { toCard } from "@/components/public/listing-cards";
import { onMarket } from "@/server/public/listings";

/**
 * Homes for sale.
 *
 * A new URL rather than a mirrored one. The live Wix site has no for-sale search page,
 * only four `/properties/<slug>` pages, so there is no ranking to preserve here and the
 * slug scheme from CLAUDE.md 16 applies instead.
 *
 * Real stock since 2026-09-30 (it rendered the template's invented cards until then),
 * read through the public projection. Refreshed when a listing is published, edited or
 * withdrawn (revalidatePath in actions/stock.ts). A URL-filtered searchListings() view
 * is the next step once there is enough stock to search.
 */

export const metadata: Metadata = {
  title: "Homes for sale in Adelaide",
  description:
    "Houses, units and townhouses for sale across Adelaide. Inspection times, auction dates and the agent to call.",
  alternates: { canonical: "/for-sale" },
};

export default async function Page() {
  const forSale = (await onMarket(60)).filter((l) => l.type === "sale").map(toCard);

  return (
    <>
      <PageHero
        eyebrow="For sale"
        title="On the market"
        titleEm="right now"
        lede="Every property we are advertising for sale, with the agent who has walked the street."
        image="photo-1570129477492-45c003edd2be"
        imageAlt="Sandstone villa with a return verandah"
        facts={["Adelaide and South Australia", "Auction or private treaty"]}
      />

      <section className="sec" id="listings">
        <div className="wrap">
          <ListingsGrid
            items={forSale}
            empty={
              <p className="lede">
                Nothing is advertised for sale right now. We usually know what is coming, so
                talk to the office.
              </p>
            }
          />
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

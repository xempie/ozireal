import type { Metadata } from "next";
import { PageHero, CtaBand } from "@/components/public/page-shell";
import { ListingCard } from "@/components/public/listing-card";
import { DEMO_SOLD } from "@/components/public/demo-data";

/**
 * The sold and leased archive.
 *
 * A new URL; the live Wix site has no equivalent. Worth building early because the
 * archive is the site's best organic asset (CLAUDE.md 16), it is what the suburb pages
 * are eventually assembled from, and removing settled listings is the standard way an
 * agency throws away the traffic it already earned.
 *
 * Server-rendered with no filter chips: an archive is browsed, not filtered, until there
 * is enough of it to need a suburb and date filter.
 */

export const metadata: Metadata = {
  title: "Recently sold and leased",
  description:
    "What we have sold and leased across Adelaide, with the result on each one. The archive stays up so you can see how a street has actually moved.",
  alternates: { canonical: "/sold" },
};

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Archive"
        title="Sold and"
        titleEm="leased"
        lede="Results stay on the site. If you want to know what a street is doing, the honest answer is what has settled on it, not what is being asked."
        image="photo-1598228723793-52759bba239c"
        imageAlt="Brick home framed by green trees"
        facts={["Results kept", "Prospect and Glenelg"]}
      />

      <section className="sec">
        <div className="wrap">
          <div className="grid">
            {DEMO_SOLD.map((l) => (
              <ListingCard key={l.id} l={l} />
            ))}
          </div>
        </div>
      </section>

      <CtaBand
        heading="Want to know what yours is"
        headingEm="worth?"
        label="Book a free appraisal"
        href="/free-property-appraisal-sa"
      />
    </>
  );
}

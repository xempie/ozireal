import type { Metadata } from "next";
import { PageHero, CtaBand } from "@/components/public/page-shell";
import { ListingCard } from "@/components/public/listing-card";
import { toCard } from "@/components/public/listing-cards";
import { soldAndLeased } from "@/server/public/listings";

/**
 * The sold and leased archive.
 *
 * A new URL; the live Wix site has no equivalent. Worth building early because the
 * archive is the site's best organic asset (CLAUDE.md 16), it is what the suburb pages
 * are eventually assembled from, and removing settled listings is the standard way an
 * agency throws away the traffic it already earned.
 *
 * Real results only, since 2026-09-30. It showed the template's invented sales until
 * then, and an invented sale result is a claim about past performance, which an agency
 * may not make. A result figure appears only where the agent authored one.
 */

export const metadata: Metadata = {
  title: "Recently sold and leased",
  description:
    "What we have sold and leased across Adelaide. The archive stays up so you can see how a street has actually moved.",
  alternates: { canonical: "/sold" },
};

export default async function Page() {
  const done = (await soldAndLeased(60)).map(toCard);

  return (
    <>
      <PageHero
        eyebrow="Archive"
        title="Sold and"
        titleEm="leased"
        lede="Results stay on the site. If you want to know what a street is doing, the honest answer is what has settled on it, not what is being asked."
        image="photo-1598228723793-52759bba239c"
        imageAlt="Brick home framed by green trees"
        facts={["Results kept", "Adelaide and South Australia"]}
      />

      <section className="sec">
        <div className="wrap">
          {done.length === 0 ? (
            <p className="lede">
              Settled sales and leases will appear here. Ask the office about recent results in
              your street.
            </p>
          ) : (
            <div className="grid">
              {done.map((l) => (
                <ListingCard key={l.id} l={l} />
              ))}
            </div>
          )}
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

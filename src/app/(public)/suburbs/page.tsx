import type { Metadata } from "next";
import Link from "next/link";
import { PageHero, CtaBand } from "@/components/public/page-shell";
import { suburbsWithListings } from "@/server/public/listings";

/**
 * Suburb index. Only suburbs where the agency has advertised, sold or leased something
 * are listed; a page for a suburb with nothing on it would be thin content.
 */

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Adelaide suburbs we work in",
  description:
    "Adelaide suburbs where OziRealty has properties for sale and rent, and recent sold and leased results.",
  alternates: { canonical: "/suburbs" },
};

export default async function Page() {
  const list = await suburbsWithListings();

  return (
    <>
      <PageHero
        eyebrow="Suburbs"
        title="Adelaide suburbs"
        titleEm="we work in"
        lede="Every suburb where we have a property on the market or a recent result. Choose one to see what is available there now and what has sold or leased."
        image="photo-1568605114967-8130f3a36994"
        imageAlt="Character home in Prospect"
        facts={["Real listings only", "Adelaide and South Australia"]}
      />

      <section className="sec">
        <div className="wrap">
          {list.length === 0 ? (
            <p className="lede">Suburb pages appear here as listings go live.</p>
          ) : (
            <ul className="suburb-list">
              {list.map((s) => (
                <li key={s.slug}>
                  <Link href={`/suburbs/${s.slug}`}>
                    <b>{s.name} real estate</b>
                    <span>
                      {s.onMarket} on the market &middot; {s.settled} sold or leased
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <CtaBand
        heading="Want a written report on"
        headingEm="your suburb?"
        label="Get a free suburb insight report"
        href="/free-suburb-insight-report"
      />
    </>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHero, CtaBand } from "@/components/public/page-shell";
import { ListingCard } from "@/components/public/listing-card";
import { toCard } from "@/components/public/listing-cards";
import { listingsInSuburb, suburbsWithListings } from "@/server/public/listings";

/**
 * One suburb: what we have on the market there and what has sold or leased.
 *
 * Built from our own listings only. No medians, growth rates or yields: the agency has
 * no licensed data source, and publishing market statistics it cannot stand behind is a
 * misleading representation. The suburb insight report is where those questions go.
 */

export const revalidate = 3600;

async function find(slug: string) {
  return (await suburbsWithListings()).find((s) => s.slug === slug) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const s = await find((await params).slug);
  if (!s) return {};
  return {
    title: `${s.name} real estate: property for sale, rent and sold`,
    description: `Property in ${s.name}, Adelaide, from OziRealty: what is for sale and for rent now, and recent sold and leased results.`,
    alternates: { canonical: `/suburbs/${s.slug}` },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const s = await find((await params).slug);
  if (!s) notFound();

  const all = (await listingsInSuburb(s.name)).map(toCard);
  const settled = (tag: string) => tag === "Sold" || tag === "Leased";
  const current = all.filter((l) => !settled(l.tag));
  const done = all.filter((l) => settled(l.tag));

  return (
    <>
      <PageHero
        eyebrow="Suburb"
        title={s.name}
        titleEm="real estate"
        lede={`What OziRealty has on the market in ${s.name} right now, and what we have sold or leased there.`}
        image="photo-1600596542815-ffad4c1539a9"
        imageAlt={`Home in ${s.name}, Adelaide`}
        facts={[`${s.onMarket} on the market`, `${s.settled} sold or leased`]}
      />

      <section className="sec">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <p className="eyebrow">Available now</p>
              <h2 className="display">
                On the market in <em>{s.name}</em>
              </h2>
            </div>
          </div>
          {current.length === 0 ? (
            <p className="lede">
              Nothing advertised in {s.name} right now. The office often knows what is coming
              before it is listed, so ask.
            </p>
          ) : (
            <div className="grid">
              {current.map((l) => (
                <ListingCard key={l.id} l={l} />
              ))}
            </div>
          )}
        </div>
      </section>

      {done.length > 0 && (
        <section className="sec" style={{ background: "var(--paper-2)" }}>
          <div className="wrap">
            <div className="sec-head">
              <div>
                <p className="eyebrow">Results</p>
                <h2 className="display">
                  Sold and leased in <em>{s.name}</em>
                </h2>
              </div>
            </div>
            <div className="grid">
              {done.map((l) => (
                <ListingCard key={l.id} l={l} />
              ))}
            </div>
          </div>
        </section>
      )}

      <CtaBand
        heading={`What is your ${s.name} property`}
        headingEm="worth?"
        label="Get a free property appraisal"
        href="/free-property-appraisal-sa"
      />
    </>
  );
}

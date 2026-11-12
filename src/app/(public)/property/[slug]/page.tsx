import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { listingBySlug, inspectionsForListing } from "@/server/public/listings";
import { AGENCY } from "@/components/public/agency";

/**
 * One listing's own page (2026-11-12). Built for the matched-buyer emails, whose
 * "View the property" button needs somewhere to land, and linked from every card.
 *
 * Reads ONLY the public projection (listingBySlug, §3.8): advertised listings that are
 * on the market, sold or leased. The price is the agent's authored string, verbatim.
 */

export const revalidate = 300;

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const l = await listingBySlug((await params).slug);
  if (!l) return { title: "Property not found" };
  const title = `${l.streetAddress}, ${l.suburb ?? ""}`.trim();
  return {
    title,
    description: l.headline ?? `${l.propertyType} ${l.type === "rent" ? "for lease" : "for sale"} in ${l.suburb ?? "Adelaide"}.`,
    alternates: { canonical: `/property/${l.slug}` },
    openGraph: l.coverPhoto ? { images: [`/media/${l.coverPhoto}`] } : undefined,
  };
}

export default async function PropertyPage({ params }: Params) {
  const l = await listingBySlug((await params).slug);
  if (!l) notFound();
  const opens = l.status === "live" || l.status === "under_offer" ? await inspectionsForListing(l.id) : [];
  const done = l.status === "sold" || l.status === "leased";
  const price = done ? (l.resultDisplay ?? (l.status === "sold" ? "Sold" : "Leased")) : (l.priceDisplay ?? "Contact agent");
  const specs = [
    l.beds != null && `${l.beds} bed`,
    l.baths != null && `${l.baths} bath`,
    l.parking != null && `${l.parking} car`,
    l.landSqm && `${l.landSqm} m² land`,
  ].filter(Boolean) as string[];
  const when = (d: Date) =>
    new Intl.DateTimeFormat("en-AU", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Australia/Adelaide",
    }).format(d);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: `${l.streetAddress}, ${l.suburb ?? ""}`,
    url: `https://www.ozirealty.com.au/property/${l.slug}`,
    ...(l.coverPhoto ? { image: `https://www.ozirealty.com.au/media/${l.coverPhoto}` } : {}),
    ...(l.headline ? { description: l.headline } : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: l.streetAddress,
      addressLocality: l.suburb,
      addressRegion: l.state,
      postalCode: l.postcode,
      addressCountry: "AU",
    },
  };

  return (
    <>
      <section className="sec">
        <div className="wrap" style={{ maxWidth: 980 }}>
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
          <p className="eyebrow">
            {done ? (l.status === "sold" ? "Sold" : "Leased") : l.type === "rent" ? "For lease" : "For sale"}
            {l.suburb ? ` · ${l.suburb}` : ""}
          </p>
          <h1 style={{ margin: "6px 0 4px" }}>{l.streetAddress}</h1>
          <p className="lede" style={{ margin: 0 }}>
            {[l.suburb, l.state, l.postcode].filter(Boolean).join(" ")}
          </p>

          <div
            style={{
              position: "relative",
              aspectRatio: "3 / 2",
              borderRadius: 14,
              overflow: "hidden",
              margin: "20px 0",
              background: "#EEF1F6",
            }}
          >
            {l.coverPhoto ? (
              <Image
                src={`/media/${l.coverPhoto}`}
                alt={l.address}
                fill
                priority
                sizes="(max-width: 1000px) 100vw, 980px"
                style={{ objectFit: "cover" }}
              />
            ) : (
              <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#6B7280" }}>
                Photos coming soon
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 24px", alignItems: "baseline" }}>
            {/* The authored string, printed exactly. Never composed from a number. */}
            <strong style={{ fontSize: 24 }}>{price}</strong>
            {specs.length > 0 && <span style={{ fontSize: 17 }}>{specs.join(" · ")}</span>}
            {l.method && !done && <span style={{ color: "#6B7280" }}>{l.method}</span>}
          </div>

          {l.headline && <h2 style={{ fontSize: 22, margin: "22px 0 8px" }}>{l.headline}</h2>}
          {l.copy && (
            <div style={{ fontSize: 16.5, lineHeight: 1.7 }}>
              {l.copy.split(/\n{2,}/).map((p, i) => (
                <p key={i} style={{ margin: "0 0 12px", whiteSpace: "pre-line" }}>
                  {p}
                </p>
              ))}
            </div>
          )}

          {opens.length > 0 && (
            <div style={{ margin: "20px 0" }}>
              <h3 style={{ fontSize: 17, marginBottom: 6 }}>Inspections</h3>
              <ul style={{ paddingLeft: 18, margin: 0 }}>
                {opens.map((o) => (
                  <li key={o.id}>
                    {when(o.startsAt)} · {o.kind === "open" ? "Open home" : "Private inspection"}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!done && (
            <div
              style={{
                marginTop: 26,
                padding: 20,
                borderRadius: 14,
                background: "#13254A",
                color: "#fff",
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <strong style={{ fontSize: 17 }}>Interested in this property?</strong>
                <div style={{ opacity: 0.85 }}>
                  Talk to {AGENCY.principal} directly. No middle men.
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <a href={AGENCY.phoneHref} className="btn">
                  Call {AGENCY.phone}
                </a>
                <Link href="/contact" className="btn btn--onink">
                  Send an enquiry
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

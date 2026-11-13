import { and, eq, sql } from "drizzle-orm";
import { withTenant } from "@/db";
import { listings, properties, suburbs } from "@/db/schema";
import { EMAIL_SIGNATURE_HTML } from "./notices";

/**
 * The matched-buyer email's HTML (2026-11-12): the personal paragraphs the agent
 * approved, then a property card (main photo, price wording verbatim, specs, a button to
 * the listing's own page), the owner's signature, and the unsubscribe line.
 *
 * Only public listing fields are used, the same ones the website shows (§3.8). Inline
 * styles and tables: email clients ignore stylesheets.
 */

const SITE = "https://www.ozirealty.com.au";
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type EmailProperty = {
  address: string;
  suburb: string | null;
  priceDisplay: string | null;
  specs: string;
  headline: string | null;
  url: string | null;
  photoUrl: string | null;
  /** Always set: the listing page when live, else the most relevant page of the site. */
  link: { url: string; label: string };
};

/** The listing's public facts for the email card, or null if it has none to show. */
export async function emailPropertyFor(tenantId: string, listingId: string): Promise<EmailProperty | null> {
  const [l] = await withTenant(tenantId, (tx) =>
    tx
      .select({
        slug: listings.slug,
        status: listings.status,
        section: listings.websiteSection,
        type: listings.listingType,
        priceDisplay: listings.priceDisplay,
        headline: listings.publicHeadline,
        street: sql<string>`trim(coalesce(${properties.unit} || '/', '') || coalesce(${properties.streetNumber} || ' ', '') || coalesce(${properties.street}, ''))`,
        suburb: suburbs.name,
        beds: properties.beds,
        baths: properties.baths,
        parking: properties.parking,
        land: properties.landAreaSqm,
        photo: sql<string | null>`(select m.s3_key from listing_media m where m.listing_id = ${listings.id} and m.kind = 'photo' order by m.sort_order, m.created_at limit 1)`,
      })
      .from(listings)
      .innerJoin(properties, eq(properties.id, listings.propertyId))
      .leftJoin(suburbs, eq(suburbs.id, properties.suburbId))
      .where(and(eq(listings.id, listingId)))
      .limit(1),
  );
  if (!l) return null;
  const onSite = l.section === "advertised" && ["live", "under_offer"].includes(l.status);
  const url = onSite ? `${SITE}/property/${l.slug}` : null;
  const link = url
    ? { url, label: "View the property" }
    : l.section === "new_homes"
      ? { url: `${SITE}/new-homes-adelaide`, label: "See our new homes and projects" }
      : l.type === "rent"
        ? { url: `${SITE}/rent-property-house-adelaide`, label: "See our rentals" }
        : { url: `${SITE}/buyer-agent-adelaide`, label: "How we help buyers" };
  return {
    link,
    address: l.street,
    suburb: l.suburb,
    priceDisplay: l.priceDisplay,
    specs: [
      l.beds != null && `${l.beds} bed`,
      l.baths != null && `${l.baths} bath`,
      l.parking != null && `${l.parking} car`,
      l.land && `${l.land} m²`,
    ]
      .filter(Boolean)
      .join(" · "),
    headline: l.headline,
    url,
    photoUrl: l.photo && onSite ? `${SITE}/media/${l.photo}` : null,
  };
}

export function propertyEmailHtml(o: {
  body: string;
  property: EmailProperty | null;
  unsubscribeUrl: string;
  agencyLine: string;
}) {
  const paras = o.body
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const p = o.property;
  const card = !p
    ? `<p style="margin:8px 0 20px"><a href="${SITE}" style="display:inline-block;background:#D84315;color:#ffffff;text-decoration:none;font-weight:bold;padding:11px 20px;border-radius:8px;font-size:15px">Visit ozirealty.com.au</a></p>`
    : `
<table cellpadding="0" cellspacing="0" width="100%" style="margin:8px 0 20px;border:1px solid #E3E7EF;border-radius:12px;overflow:hidden">
  ${p.photoUrl ? `<tr><td><a href="${esc(p.link.url)}"><img src="${esc(p.photoUrl)}" alt="${esc(p.address)}" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0"></a></td></tr>` : ""}
  <tr><td style="padding:16px 18px;font-family:Arial,sans-serif;color:#13254A">
    ${p.priceDisplay ? `<div style="font-size:18px;font-weight:bold;margin-bottom:4px">${esc(p.priceDisplay)}</div>` : ""}
    <div style="font-size:16px;font-weight:bold">${esc(p.address)}${p.suburb ? `, ${esc(p.suburb)}` : ""}</div>
    ${p.specs ? `<div style="font-size:14px;color:#4B5563;margin-top:4px">${esc(p.specs)}</div>` : ""}
    ${p.headline ? `<div style="font-size:14px;margin-top:8px">${esc(p.headline)}</div>` : ""}
    <a href="${esc(p.link.url)}" style="display:inline-block;margin-top:14px;background:#D84315;color:#ffffff;text-decoration:none;font-weight:bold;padding:11px 20px;border-radius:8px;font-size:15px">${esc(p.link.label)}</a>
  </td></tr>
</table>`;

  return `<!doctype html><html><body style="margin:0;background:#F5F6F9">
<table cellpadding="0" cellspacing="0" width="100%" style="background:#F5F6F9"><tr><td align="center" style="padding:24px 12px">
<table cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#ffffff;border-radius:14px">
<tr><td style="padding:28px 24px;font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1F2937">
${paras}
${card}
${EMAIL_SIGNATURE_HTML}
<p style="margin:24px 0 0;font-size:12px;color:#6B7280;line-height:1.5">${esc(o.agencyLine)}<br>
You are receiving this because you asked us about property. <a href="${esc(o.unsubscribeUrl)}" style="color:#6B7280">Unsubscribe</a></p>
</td></tr></table>
</td></tr></table>
</body></html>`;
}

/** The plain-text twin, with the property link and the unsubscribe line. */
export function propertyEmailText(o: { body: string; property: EmailProperty | null; unsubscribeUrl: string; agencyLine: string }) {
  const p = o.property;
  return [
    o.body.trim(),
    "",
    ...(p
      ? [
          `${p.address}${p.suburb ? `, ${p.suburb}` : ""}`,
          ...(p.priceDisplay ? [p.priceDisplay] : []),
          ...(p.specs ? [p.specs] : []),
          `${p.link.label}: ${p.link.url}`,
          "",
        ]
      : [`www.ozirealty.com.au`, ""]),
    "Esi Dor | Ozi Realty · 1800 400 333 · www.ozirealty.com.au",
    "—",
    o.agencyLine,
    `Unsubscribe: ${o.unsubscribeUrl}`,
  ].join("\n");
}

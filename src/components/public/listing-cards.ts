import type { PublicListing } from "@/server/public/listings";
import type { CardListing } from "./listing-card";
import { AGENCY } from "./agency";

/**
 * A real listing (from the public projection) as a card.
 *
 * Replaces the template's demo cards, which the home page, /for-sale and /sold showed
 * long after real stock existed. Invented listings and invented sale results on a
 * licensed agency's site are misleading representations, not placeholders.
 *
 * Wording rules carried over: the price is the agent's authored `priceDisplay`,
 * printed verbatim; with none, "Contact agent" (a statement, not a price). A sold or
 * leased card shows `resultDisplay` only where the agent authored one.
 */
export function toCard(l: PublicListing): CardListing {
  const auction = (l.method ?? "").toLowerCase().includes("auction");
  const done = l.status === "sold" || l.status === "leased";
  const cat: CardListing["cat"] =
    l.type === "rent" ? "lease" : l.status === "under_offer" ? "offer" : auction ? "auction" : "sale";

  const tag = done
    ? l.status === "sold"
      ? "Sold"
      : "Leased"
    : cat === "lease"
      ? "For lease"
      : cat === "offer"
        ? "Under offer"
        : cat === "auction"
          ? "Auction"
          : "For sale";

  return {
    id: l.id,
    cat,
    tag,
    tagClass: cat === "auction" && !done ? "tag--accent" : cat === "offer" || done ? "tag--ink" : "",
    price: done
      ? (l.resultDisplay ?? (l.status === "sold" ? "Sold" : "Leased"))
      : (l.priceDisplay ?? "Contact agent"),
    addr: l.streetAddress,
    sub: [l.suburb, l.state, l.postcode].filter(Boolean).join(" "),
    bed: l.beds,
    bath: l.baths,
    car: l.parking,
    land: l.landSqm ? `${l.landSqm} m²` : "",
    agent: AGENCY.principal,
    open: l.headline ?? "",
    img: null,
    alt: l.address,
  };
}

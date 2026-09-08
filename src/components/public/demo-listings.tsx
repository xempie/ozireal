"use client";

import * as React from "react";
import { DEMO_FILTERS, DEMO_LISTINGS, type DemoListing } from "./demo-data";
import { ListingCard } from "./listing-card";

/**
 * The listings grid and its filter chips, from the template.
 *
 * A client island because the chips filter without a round trip, exactly as the template
 * did. All the cards are in the DOM on the server render regardless of the active chip:
 * the filter narrows what is displayed, it does not fetch.
 *
 * The card itself lives in listing-card.tsx and is shared with the server-rendered grid
 * on /sold, so the two cannot drift apart.
 */
export function DemoListings({ items = DEMO_LISTINGS }: { items?: DemoListing[] }) {
  const [filter, setFilter] = React.useState<string>("all");

  /*
    Only offer a chip that would return something. On /for-sale the "For lease" chip
    would otherwise sit there emptying the grid, which reads as a broken filter rather
    than an empty category.
  */
  const available = DEMO_FILTERS.filter(
    (f) => f.key === "all" || items.some((l) => l.cat === f.key),
  );
  const shown = filter === "all" ? items : items.filter((l) => l.cat === filter);

  return (
    <>
      {available.length > 2 && (
        <div className="chips">
          {available.map((f) => (
            <button
              key={f.key}
              type="button"
              className="chip"
              aria-pressed={f.key === filter}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid">
        {shown.map((l) => (
          <ListingCard key={l.id} l={l} />
        ))}
      </div>
    </>
  );
}

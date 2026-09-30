"use client";

import * as React from "react";
import { ListingCard, type CardListing } from "./listing-card";

/**
 * The listings grid, with optional filter chips.
 *
 * The chips can be switched off from the console (Website → Homepage), which the
 * agency asked for while there are only a few listings: chips over three cards are
 * noise. Even when on, a chip is only offered if it would return something, and the
 * row only appears when there is a real choice (at least two categories).
 */

const FILTERS = [
  { key: "all", label: "Everything" },
  { key: "sale", label: "For sale" },
  { key: "auction", label: "Auction" },
  { key: "lease", label: "For lease" },
  { key: "offer", label: "Under offer" },
] as const;

export function ListingsGrid({
  items,
  showFilters = true,
  empty,
}: {
  items: CardListing[];
  showFilters?: boolean;
  empty?: React.ReactNode;
}) {
  const [filter, setFilter] = React.useState<string>("all");

  const available = FILTERS.filter((f) => f.key === "all" || items.some((l) => l.cat === f.key));
  const shown = filter === "all" ? items : items.filter((l) => l.cat === filter);

  if (items.length === 0) return <>{empty ?? null}</>;

  return (
    <>
      {showFilters && available.length > 2 && (
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

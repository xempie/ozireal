"use client";

import * as React from "react";
import { SEARCH_TABS } from "./demo-data";

/**
 * The hero search panel, as a demo.
 *
 * The template's version relabelled the price field and the submit button as the
 * Buy/Rent/Sold tab changed, and searched nothing. This does the same and says so: the
 * button carries the template's counts, and submitting is disabled rather than posting
 * to a route that does not exist yet.
 *
 * When the search is wired up this becomes a plain `<form action="/for-sale" method="get">`
 * again — a GET form needs no JavaScript, and a result set that lives in the URL is
 * linkable and crawlable, which is the whole point of building it that way.
 */
export function DemoSearch() {
  const [tab, setTab] = React.useState<(typeof SEARCH_TABS)[number]["key"]>("buy");
  const active = SEARCH_TABS.find((t) => t.key === tab)!;

  return (
    <div className="search">
      <div className="search-tabs" role="tablist" aria-label="Search type">
        {SEARCH_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === tab}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="search-row">
        <div className="field">
          <label htmlFor="q">Suburb, postcode or street</label>
          <input id="q" name="suburb" type="text" placeholder="Try Prospect, Norwood or 5082" />
        </div>
        <div className="field">
          <label htmlFor="type">Property type</label>
          <select id="type" name="type" defaultValue="">
            <option value="">All types</option>
            <option>House</option>
            <option>Townhouse</option>
            <option>Apartment</option>
            <option>Land</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="price">{active.priceLabel}</label>
          <select id="price" name="max" defaultValue="">
            <option value="">Any price</option>
            <option>$600,000</option>
            <option>$850,000</option>
            <option>$1.2m</option>
            <option>$2m+</option>
          </select>
        </div>
        {/*
          Disabled on purpose. A search button that looks live and goes to a 404 is worse
          than one that admits the results page is not built yet.
        */}
        <button className="btn" type="button" disabled title="Search results are not built yet">
          {active.cta}
        </button>
      </div>
    </div>
  );
}

"use client";

import * as React from "react";

/**
 * The projects page's finder: search, area, budget, sort, type, "ready now".
 *
 * Two compact rows (owner's request, 2026-10-31) so the first projects show without
 * scrolling. The cards stay server-rendered (they are `children`); this only reads the
 * data-* attributes ProjectGrid puts on each one and hides or reorders them. So a visitor
 * without JavaScript still sees every project, and nothing here touches prices other than
 * the numeric priceMin/priceMax, which exist for filtering only.
 */

const BUDGETS: [label: string, min: number, max: number][] = [
  ["Under $700k", 0, 699_999],
  ["$700k – $850k", 700_000, 850_000],
  ["$850k – $1M", 850_001, 1_000_000],
  ["$1M+", 1_000_001, Number.POSITIVE_INFINITY],
];

type Sort = "feat" | "lo" | "hi";

export function ProjectFinder({
  areas,
  kinds,
  children,
}: {
  areas: string[];
  kinds: string[];
  children: React.ReactNode;
}) {
  const gridRef = React.useRef<HTMLDivElement>(null);
  const [q, setQ] = React.useState("");
  const [area, setArea] = React.useState("");
  const [types, setTypes] = React.useState<Set<string>>(new Set());
  const [budget, setBudget] = React.useState("");
  const [ready, setReady] = React.useState(false);
  const [sort, setSort] = React.useState<Sort>("feat");
  const [shown, setShown] = React.useState<number | null>(null);
  const [total, setTotal] = React.useState(0);
  const [top, setTop] = React.useState(0);

  // Stick just below the site's own sticky nav, whatever height it is.
  React.useEffect(() => {
    const nav = document.querySelector<HTMLElement>(".nav");
    if (!nav) return;
    const measure = () => setTop(nav.offsetHeight);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  React.useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const cards = Array.from(grid.querySelectorAll<HTMLElement>("[data-proj]"));
    const needle = q.trim().toLowerCase();
    const band = BUDGETS.find(([label]) => label === budget);
    let count = 0;
    const visible: { el: HTMLElement; lo: number | null; order: number }[] = [];

    for (const el of cards) {
      const d = el.dataset;
      const lo = d.lo ? Number(d.lo) : null;
      const hi = d.hi ? Number(d.hi) : lo;
      // A project matches a budget when any part of its price range falls inside it.
      const inBudget = !band || (lo !== null && lo <= band[2] && (hi ?? lo) >= band[1]);
      const ok =
        (!needle || (d.name ?? "").toLowerCase().includes(needle)) &&
        (!area || d.area === area) &&
        (types.size === 0 || types.has(d.kind ?? "")) &&
        inBudget &&
        (!ready || d.ready === "1");
      el.hidden = !ok;
      if (ok) {
        count++;
        visible.push({ el, lo, order: Number(d.order) });
      }
    }

    // Reorder with CSS `order`, so the DOM (and its server-rendered content) never moves.
    if (sort === "feat") {
      for (const v of visible) v.el.style.order = "";
    } else {
      const dir = sort === "lo" ? 1 : -1;
      visible
        .sort((a, b) => {
          if (a.lo === null || b.lo === null) return (a.lo === null ? 1 : 0) - (b.lo === null ? 1 : 0);
          return dir * (a.lo - b.lo) || a.order - b.order;
        })
        .forEach((v, i) => (v.el.style.order = String(i)));
    }
    setShown(count);
    setTotal(cards.length);
  }, [q, area, types, budget, ready, sort]);

  const toggleType = (k: string) => {
    const next = new Set(types);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setTypes(next);
  };
  const clear = () => {
    setQ("");
    setArea("");
    setTypes(new Set());
    setBudget("");
    setReady(false);
    setSort("feat");
  };

  return (
    <>
      <div className="pf" style={{ top }}>
        <div className="pf-r1">
          <input
            id="pf-q"
            className="pf-search"
            type="search"
            placeholder="Search a suburb, e.g. Modbury"
            aria-label="Search by suburb"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select id="pf-area" className="pf-select" aria-label="Area" value={area} onChange={(e) => setArea(e.target.value)}>
            <option value="">All areas</option>
            {areas.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
          <select id="pf-budget" className="pf-select" aria-label="Budget" value={budget} onChange={(e) => setBudget(e.target.value)}>
            <option value="">Any budget</option>
            {BUDGETS.map(([label]) => (
              <option key={label}>{label}</option>
            ))}
          </select>
          <select id="pf-sort" className="pf-select" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="feat">Sort: Featured</option>
            <option value="lo">Price: low to high</option>
            <option value="hi">Price: high to low</option>
          </select>
        </div>
        <div className="pf-r2">
          <div className="pf-chips" role="group" aria-label="Property type">
            <button type="button" className="pf-chip" aria-pressed={types.size === 0} onClick={() => setTypes(new Set())}>
              All types
            </button>
            {kinds.map((k) => (
              <button key={k} type="button" className="pf-chip" aria-pressed={types.has(k)} onClick={() => toggleType(k)}>
                {k}
              </button>
            ))}
          </div>
          <label className="pf-toggle" htmlFor="pf-ready">
            <input id="pf-ready" type="checkbox" checked={ready} onChange={(e) => setReady(e.target.checked)} />
            Ready now
          </label>
          <span className="pf-meta">
            <button type="button" className="pf-clear" onClick={clear}>
              Clear
            </button>
            <a className="pf-ask" href="/buyer-agent-adelaide#brief">
              <span aria-hidden="true">🔎</span> Not here? We&rsquo;ll search for you &rarr;
            </a>
          </span>
        </div>
      </div>

      <div ref={gridRef}>{children}</div>

      {shown === 0 && (
        <div className="pf-empty">
          <b>No projects match those filters</b>
          Try a wider budget or another area, or{" "}
          <button type="button" className="pf-clear" onClick={clear}>
            clear filters
          </button>
          .
          <span className="pf-empty-ba">
            Or let our buyer&rsquo;s agent find it, including homes that never reach the portals.
          </span>
          <a className="btn" href="/buyer-agent-adelaide#brief">
            Find it for me &rarr;
          </a>
        </div>
      )}
    </>
  );
}

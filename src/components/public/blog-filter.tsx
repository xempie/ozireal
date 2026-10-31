"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

/**
 * The journal's search, topic and sort filter (2026-10-31).
 *
 * Every card is server-rendered into the props, so the full archive is in the HTML for
 * crawlers; this only decides which are visible. Topic chips show live counts.
 */

export type BlogCard = {
  href: string;
  title: string;
  description: string;
  cover: string | null;
  coverAlt: string;
  date: string;
  dateLabel: string;
  minutes: number;
  topics: { key: string; label: string }[];
};

type Sort = "new" | "old" | "short";

export function BlogFilter({
  cards,
  topics,
  initialTopic = "",
}: {
  cards: BlogCard[];
  topics: { key: string; label: string }[];
  initialTopic?: string;
}) {
  const [topic, setTopic] = useState(initialTopic);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("new");
  const [top, setTop] = useState(0);

  // Stick just below the site's own sticky nav, whatever height it is (as the projects finder does).
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>(".nav");
    if (!nav) return;
    const measure = () => setTop(nav.offsetHeight);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cards) for (const t of c.topics) m.set(t.key, (m.get(t.key) ?? 0) + 1);
    return m;
  }, [cards]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = cards.filter(
      (c) =>
        (!topic || c.topics.some((t) => t.key === topic)) &&
        (!needle || `${c.title} ${c.description}`.toLowerCase().includes(needle)),
    );
    return [...list].sort((a, b) =>
      sort === "old" ? a.date.localeCompare(b.date) : sort === "short" ? a.minutes - b.minutes : b.date.localeCompare(a.date),
    );
  }, [cards, topic, q, sort]);

  return (
    <>
      <div className="bf" style={{ top }}>
        <div className="wrap bf-in">
          <div className="bf-r1">
            <input
              className="pf-search"
              type="search"
              placeholder="Search guides, e.g. rent review, appraisal, Prospect"
              aria-label="Search the journal"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select className="pf-select" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="new">Newest first</option>
              <option value="old">Oldest first</option>
              <option value="short">Quick reads first</option>
            </select>
          </div>
          <div className="bf-chips" role="group" aria-label="Topic">
            <button type="button" className="pf-chip" aria-pressed={topic === ""} onClick={() => setTopic("")}>
              All topics <b>{cards.length}</b>
            </button>
            {topics
              .filter((t) => counts.get(t.key))
              .map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className="pf-chip"
                  aria-pressed={topic === t.key}
                  onClick={() => setTopic(t.key)}
                >
                  {t.label} <b>{counts.get(t.key)}</b>
                </button>
              ))}
          </div>
          <span className="pf-count" aria-live="polite">
            Showing <b>{shown.length}</b> of {cards.length} guides
          </span>
        </div>
      </div>

      <section className="sec" style={{ background: "var(--paper-2)", paddingTop: 28 }}>
        <div className="wrap">
          {shown.length === 0 ? (
            <div className="pf-empty">
              <b>No guides match</b>
              Try another topic or{" "}
              <button
                type="button"
                className="pf-clear"
                onClick={() => {
                  setQ("");
                  setTopic("");
                }}
              >
                clear the search
              </button>
              .
            </div>
          ) : (
            <div className="posts posts--three">
              {shown.map((c) => (
                <article className="post bf-card" key={c.href}>
                  <Link href={c.href} className="bf-link" aria-label={c.title}>
                    {c.cover && (
                      <div className="post-media">
                        <Image
                          src={c.cover}
                          alt={c.coverAlt}
                          width={800}
                          height={457}
                          sizes="(max-width: 640px) 100vw, (max-width: 1080px) 50vw, 33vw"
                        />
                      </div>
                    )}
                  </Link>
                  <div className="bf-tags">
                    {c.topics.map((t, i) => (
                      <Link key={t.key} className={i ? "bf-tag" : "bf-tag bf-tag--lead"} href={`/blog/topic/${t.key}`}>
                        {t.label}
                      </Link>
                    ))}
                  </div>
                  <h3>
                    <Link href={c.href}>{c.title}</Link>
                  </h3>
                  <p>{c.description}</p>
                  <span className="meta">
                    {c.dateLabel} &middot; {c.minutes} min
                  </span>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

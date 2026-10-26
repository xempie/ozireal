import Image from "next/image";
import { photo } from "./agency";

/**
 * One listing card.
 *
 * No "use client" directive, deliberately. On a server page it renders on the server;
 * imported by the client filter island it compiles into that bundle. One definition
 * either way, which is what stops the grids on different pages drifting apart.
 *
 * `img` is optional. Real listings have no photos until the media pipeline lands, and a
 * stock photo standing in for a specific house would misrepresent it, so a real card
 * without one shows a neutral placeholder instead.
 *
 * The cards do not link anywhere yet: there is no listing detail page, and a card that
 * looks clickable and 404s reads as a broken site rather than an unfinished one.
 */

export type ListingCategory = "sale" | "auction" | "lease" | "offer";

export interface CardListing {
  id: string;
  cat: ListingCategory;
  /** Corner flag on the card. */
  tag: string;
  /** "", "tag--accent" or "tag--ink" — the card styles that already exist. */
  tagClass: string;
  /** Authored wording, printed verbatim, never composed from a number (underquoting). */
  price: string;
  addr: string;
  sub: string;
  bed: number | null;
  bath: number | null;
  car: number | null;
  land: string;
  agent: string;
  open: string;
  /** Unsplash photo id (allow-listed host), or null for the placeholder. */
  img: string | null;
  alt: string;
}

const Bed = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 18v-7h18v7M3 18v2M21 18v2M3 13V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M7 11V9h4v2M13 11V9h4v2" />
  </svg>
);
const Bath = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 12h18v3a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-3zM6 12V6a2 2 0 0 1 4 0M7 19l-1 2M17 19l1 2" />
  </svg>
);
const Car = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 16v2M20 16v2M3 16v-4l2-5h14l2 5v4H3zM6.5 13h.01M17.5 13h.01" />
  </svg>
);
const House = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="1.2">
    <path d="M3 11.5 12 4l9 7.5M5.5 10v10h13V10M10 20v-6h4v6" />
  </svg>
);

export function ListingCard({ l }: { l: CardListing }) {
  return (
    <article className="card">
      <div className="card-media">
        <span className={`tag ${l.tagClass}`}>{l.tag}</span>
        {l.img ? (
          <Image
            src={l.img.startsWith("/") ? l.img : photo(l.img, 800)}
            alt={l.alt}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1080px) 50vw, 33vw"
            style={{ objectFit: "cover" }}
          />
        ) : (
          <div className="card-noimg" role="img" aria-label={`${l.addr}: photos coming soon`}>
            <House />
            <span>Photos coming soon</span>
          </div>
        )}
      </div>
      <div className="card-body">
        {/* The authored string, printed exactly. Never composed from a number. */}
        <div className="card-price">{l.price}</div>
        <h3 className="card-addr">{l.addr}</h3>
        <p className="card-sub">{l.sub}</p>
        <div className="specs">
          <span className="s">
            <Bed />
            <span className="sr-only">bedrooms</span>
            {l.bed ?? "—"}
          </span>
          <span className="s">
            <Bath />
            <span className="sr-only">bathrooms</span>
            {l.bath ?? "—"}
          </span>
          <span className="s">
            <Car />
            <span className="sr-only">car spaces</span>
            {l.car ?? "—"}
          </span>
          <span className="land">{l.land}</span>
        </div>
        <div className="card-foot">
          <span>{l.open}</span>
          <span className="go">{l.agent}</span>
        </div>
      </div>
    </article>
  );
}

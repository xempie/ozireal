import Image from "next/image";
import { photo } from "./agency";
import { type DemoListing } from "./demo-data";

/**
 * One listing card.
 *
 * No "use client" directive, deliberately. On a server page it renders on the server;
 * imported by the client filter island it compiles into that bundle. One definition
 * either way, which is what stops the grid on /for-sale drifting from the grid on the
 * home page.
 *
 * The cards do not link anywhere yet. `/for-sale/[slug]` does not exist, and a card that
 * looks clickable and 404s reads as a broken site rather than an unfinished one.
 */

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

export function ListingCard({ l }: { l: DemoListing }) {
  return (
    <article className="card">
      <div className="card-media">
        <span className={`tag ${l.tagClass}`}>{l.tag}</span>
        <Image
          src={photo(l.img, 800)}
          alt={l.alt}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1080px) 50vw, 33vw"
          style={{ objectFit: "cover" }}
        />
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
            {l.bed}
          </span>
          <span className="s">
            <Bath />
            <span className="sr-only">bathrooms</span>
            {l.bath}
          </span>
          <span className="s">
            <Car />
            <span className="sr-only">car spaces</span>
            {l.car}
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

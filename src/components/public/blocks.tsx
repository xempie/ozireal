import Image from "next/image";
import Link from "next/link";
import type { Block } from "@/lib/site-content";
import { GALLERY, IMAGE_IDS } from "@/lib/site-content";
import { FormSection } from "./forms/form-section";
import { ListingCard } from "./listing-card";
import { toCard } from "./listing-cards";
import { PageHero } from "./page-shell";
import { photo } from "./agency";
import { ProjectFinder } from "./project-finder";
import { onMarket, soldAndLeased } from "@/server/public/listings";
import { Bath, BedDouble, Car, LandPlot, Ruler } from "lucide-react";
import type { PublicNewHomesProject } from "@/server/public/listings";

/**
 * Renders blocks added in the console's website editor.
 *
 * Every value is plain text rendered by React, so nothing in a block can become markup.
 * The blocks reuse the site's own sections and classes, which is what keeps an added
 * block looking like it was always part of the page.
 */

function sectionClass(b: Block) {
  const s = b.style ?? {};
  return [
    "sec",
    s.spacing === "tight" ? "sec--tight" : s.spacing === "loose" ? "sec--loose" : "",
    s.background === "dark" ? "dark" : s.background === "accent" ? "sec--accent" : "",
    s.align === "center" ? "blk--center" : "",
    "blk",
  ]
    .filter(Boolean)
    .join(" ");
}

function sectionStyle(b: Block): React.CSSProperties | undefined {
  return b.style?.background === "paper" ? { background: "var(--paper-2)" } : undefined;
}

const isExternal = (href: string) => /^https:/i.test(href);

/**
 * A project card's button. "Talk to Esi" to the buyer's agent page lands on its brief
 * form (2026-10-31) and names the project it came from, so the enquiry in the CRM says
 * which project the person was interested in (owner's request, 2026-11-04).
 */
function projectHref(href: string, heading?: string, headingEm?: string): string {
  if (!/buyer-agent-adelaide\/?$/.test(href)) return href;
  const project = [heading, headingEm].filter(Boolean).join(" – ").slice(0, 90);
  const base = href.replace(/\/$/, "");
  return project ? `${base}?project=${encodeURIComponent(project)}#brief` : `${base}#brief`;
}

function SmartLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  if (href.startsWith("/")) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={className} {...(isExternal(href) ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {children}
    </a>
  );
}

function Heading({ eyebrow, heading, headingEm }: { eyebrow?: string; heading?: string; headingEm?: string }) {
  if (!eyebrow && !heading) return null;
  return (
    <div className="sec-head">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        {heading && (
          <h2 className="display">
            {heading}
            {headingEm ? (
              <>
                {" "}
                <em>{headingEm}</em>
              </>
            ) : null}
          </h2>
        )}
      </div>
    </div>
  );
}

async function ListingsBlock({ b }: { b: Extract<Block, { type: "listings" }> }) {
  const rows = b.show === "sold" ? await soldAndLeased(b.limit) : await onMarket(b.limit);
  const cards = rows.map(toCard);
  return (
    <section className={sectionClass(b)} style={sectionStyle(b)}>
      <div className="wrap">
        <Heading heading={b.heading} />
        {cards.length === 0 ? (
          <p className="lede">
            {b.show === "sold" ? "Results will appear here." : "Nothing is advertised right now."}
          </p>
        ) : (
          <div className="grid">
            {cards.map((l) => (
              <ListingCard key={l.id} l={l} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

const STAR = (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z" />
  </svg>
);
const FiveStars = () => (
  <span className="rv-stars" role="img" aria-label="5 out of 5 stars">
    {STAR}
    {STAR}
    {STAR}
    {STAR}
    {STAR}
  </span>
);
const AVATAR = ["#0034C8", "#D84315", "#1B7F4B", "#13254A", "#7A4FD0", "#0E7C86"];

/** Client reviews: rating summary, trust ticks, starred cards; a swipe row on phones. */
function Reviews({ b }: { b: Extract<Block, { type: "cards" }> }) {
  return (
    <section className={`${sectionClass(b)} rv`} style={sectionStyle(b)}>
      <div className="wrap">
        <div className="rv-head">
          <div>
            <p className="eyebrow">Client reviews</p>
            <h2 className="display">{b.heading}</h2>
            <ul className="rv-trust">
              <li>Real clients, real words</li>
              <li>Licensed agency, RLA 350 628</li>
              <li>Owner-run, no middle man</li>
            </ul>
          </div>
          <div className="rv-sum">
            <span className="rv-big">5.0</span>
            <span>
              <FiveStars />
              <small>From client reviews</small>
            </span>
          </div>
        </div>
        <div className="rv-grid">
          {b.items.map((c, i) => (
            <article className="rv-card" key={i}>
              <FiveStars />
              {c.highlight && <h3>{c.highlight}</h3>}
              <p>{c.body}</p>
              <div className="rv-who">
                <span className="rv-av" style={{ background: AVATAR[i % AVATAR.length] }} aria-hidden="true">
                  {c.title.charAt(0)}
                </span>
                <span>
                  <b>{c.title}</b>
                  <small>OziRealty client</small>
                </span>
              </div>
            </article>
          ))}
        </div>
        <div className="rv-cta">
          <SmartLink className="btn" href="/contact#meeting">
            Book a free consultation &rarr;
          </SmartLink>
        </div>
      </div>
    </section>
  );
}

export function BlockView({ b }: { b: Block }) {
  switch (b.type) {
    case "hero":
      return (
        <PageHero
          eyebrow={b.eyebrow ?? ""}
          title={b.title}
          titleEm={b.titleEm}
          lede={b.lede ?? ""}
          image={b.image}
          imageAlt={GALLERY[b.image]}
          noEdits
        />
      );

    case "text":
      return (
        <section className={sectionClass(b)} style={sectionStyle(b)}>
          <div className="wrap">
            <Heading eyebrow={b.eyebrow} heading={b.heading} headingEm={b.headingEm} />
            <div className="prose blk-prose">
              {b.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
              {b.bullets?.length ? (
                <ul>
                  {b.bullets.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </section>
      );

    case "image":
      return (
        <section className={sectionClass(b)} style={sectionStyle(b)}>
          <div className="wrap">
            <figure className="blk-figure">
              <Image
                src={photo(b.image, 1600)}
                alt={b.alt}
                width={1600}
                height={900}
                sizes="(max-width: 900px) 100vw, 1200px"
              />
              {b.caption && <figcaption>{b.caption}</figcaption>}
            </figure>
          </div>
        </section>
      );

    case "cta":
      return (
        <section className={`${sectionClass(b)} cta-band`} style={sectionStyle(b)}>
          <div className="wrap cta-band-inner">
            <h2 className="display">
              {b.heading}
              {b.headingEm ? (
                <>
                  {" "}
                  <em>{b.headingEm}</em>
                </>
              ) : null}
            </h2>
            <SmartLink className="btn" href={b.href}>
              {b.label}
            </SmartLink>
          </div>
        </section>
      );

    case "form":
      return <FormSection slug={b.form} />;

    case "faq":
      return (
        <section className={sectionClass(b)} style={sectionStyle(b)}>
          <div className="wrap">
            <Heading heading={b.heading} />
            <div className="faq-list">
              {b.items.map((f, i) => (
                <details className="faq" key={i}>
                  <summary className="faq-q">
                    <span>{f.q}</span>
                    <span className="svc-plus" aria-hidden="true" />
                  </summary>
                  <div className="faq-a">
                    <p>{f.a}</p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>
      );

    case "cards":
      // A cards block headed "…clients say…" or "…reviews…" renders as review cards with
      // five stars (owner's request, 2026-11-02). The owner vouches for the ratings.
      if (/clients say|review/i.test(b.heading ?? "")) return <Reviews b={b} />;
      return (
        <section className={sectionClass(b)} style={sectionStyle(b)}>
          <div className="wrap">
            <Heading heading={b.heading} />
            <div className="benefit-grid">
              {b.items.map((c, i) =>
                c.href ? (
                  <SmartLink className="benefit blk-card-link" href={c.href} key={i}>
                    <h3>{c.title}</h3>
                    {c.highlight && <p className="benefit-hl">{c.highlight}</p>}
                    <p>{c.body}</p>
                  </SmartLink>
                ) : (
                  <div className="benefit" key={i}>
                    <h3>{c.title}</h3>
                    {c.highlight && <p className="benefit-hl">{c.highlight}</p>}
                    <p>{c.body}</p>
                  </div>
                ),
              )}
            </div>
          </div>
        </section>
      );

    case "listings":
      return <ListingsBlock b={b} />;
  }
}

/* ------------------------------------------------------------ projects */

type Project = {
  image: Extract<Block, { type: "image" }>;
  text: Extract<Block, { type: "text" }>;
  cta?: Extract<Block, { type: "cta" }>;
  /** A real listing photo (a New Homes listing from the CRM); stock images have none. */
  photoUrl?: string;
};

const KIND_LABEL: Record<string, string> = {
  house: "House",
  townhouse: "Townhouse",
  unit: "Apartment",
  land: "House and land",
  acreage: "House and land",
  commercial: "Warehouse",
};

/**
 * A New Homes listing from the CRM as a project card (2026-11-05): the same card the
 * editor's image + text blocks make, fed from the allow-listed public projection.
 */
export function listingProject(p: PublicNewHomesProject): Project {
  const range = (a: number | null, b?: number | null) => (a ? String(a) + (b && b !== a ? `–${b}` : "") : undefined);
  return {
    photoUrl: p.coverPhoto ? `/media/${p.coverPhoto}` : undefined,
    image: {
      id: `listing-${p.id}-img`,
      type: "image",
      // The type needs a gallery id; photoUrl wins when the listing has a photo.
      image: IMAGE_IDS[0],
      alt: `${p.projectName ?? "New home"}, ${p.suburb ?? ""}`,
    } as Extract<Block, { type: "image" }>,
    text: {
      id: `listing-${p.id}-text`,
      type: "text",
      heading: p.suburb ?? undefined,
      headingEm: p.projectName ?? undefined,
      price: p.priceDisplay ?? undefined,
      priceMin: p.searchPriceMin ?? undefined,
      priceMax: p.searchPriceMax ?? undefined,
      area: p.area ?? undefined,
      kind: KIND_LABEL[p.propertyType] ?? undefined,
      ready: p.ready,
      highlights: p.highlights ?? undefined,
      paragraphs: [p.headline, p.copy].filter((x): x is string => !!x),
      specs: {
        beds: range(p.beds),
        baths: range(p.baths),
        parking: range(p.parking),
        landM2: range(p.landSqm),
        buildM2: range(p.floorSqm),
      },
    } as Extract<Block, { type: "text" }>,
    cta: {
      id: `listing-${p.id}-cta`,
      type: "cta",
      heading: "Talk to Esi",
      label: "Talk to Esi",
      href: "https://www.ozirealty.com.au/buyer-agent-adelaide",
    } as Extract<Block, { type: "cta" }>,
  };
}

/** CRM New Homes listings first, then the editor's cards, in one grid. */
export function withListingProjects(items: PageItem[], live: PublicNewHomesProject[]): PageItem[] {
  if (!live.length) return items;
  const extra = live.map(listingProject);
  const i = items.findIndex((x) => x.kind === "projects");
  if (i < 0) return [...items, { kind: "projects", items: extra }];
  const grid = items[i] as Extract<PageItem, { kind: "projects" }>;
  return [...items.slice(0, i), { kind: "projects", items: [...extra, ...grid.items] }, ...items.slice(i + 1)];
}

export type PageItem = { kind: "block"; b: Block } | { kind: "projects"; items: Project[] };

/**
 * An image followed by a headed text block (and optionally its CTA) is one project.
 * Runs of two or more are laid out two to a row instead of stacked full width; a lone
 * image + text pair, and everything else, renders exactly as before. Derived from the
 * block order, so the stored page and the editor are unchanged.
 */
export function groupProjects(blocks: Block[]): PageItem[] {
  const out: PageItem[] = [];
  let run: Project[] = [];
  const flush = () => {
    if (run.length >= 2) out.push({ kind: "projects", items: run });
    else for (const p of run) for (const b of [p.image, p.text, p.cta]) if (b) out.push({ kind: "block", b });
    run = [];
  };
  for (let i = 0; i < blocks.length; i++) {
    const image = blocks[i];
    const text = blocks[i + 1];
    if (image.type === "image" && text?.type === "text" && text.heading) {
      const next = blocks[i + 2];
      const cta = next?.type === "cta" ? next : undefined;
      run.push({ image, text, cta });
      i += cta ? 2 : 1;
      continue;
    }
    flush();
    out.push({ kind: "block", b: image });
  }
  flush();
  return out;
}

export function ProjectGrid({ items }: { items: Project[] }) {
  // A card without its own CTA borrows the run's first one, so every card has a button.
  const fallback = items.find((p) => p.cta)?.cta;
  const grid = (
        <div className="proj-grid">
          {items.map(({ image, text, cta = fallback, photoUrl }, i) => (
            <article
              className="proj"
              key={image.id}
              data-proj=""
              data-order={i}
              data-name={text.heading ?? ""}
              data-area={text.area ?? ""}
              data-kind={text.kind ?? ""}
              data-ready={text.ready ? "1" : "0"}
              data-lo={text.priceMin ?? ""}
              data-hi={text.priceMax ?? text.priceMin ?? ""}
            >
              <figure className="proj-fig">
                <Image
                  src={photoUrl ?? photo(image.image, 1000)}
                  alt={image.alt}
                  width={1000}
                  height={667}
                  sizes="(max-width: 900px) 100vw, 600px"
                />
                {/* The project photos are stock, so the card says so rather than implying them. */}
                {!photoUrl && <span className="proj-note">Illustrative image</span>}
                {text.highlights?.length ? (
                  <div className="proj-pills">
                    {text.highlights.map((h) => (
                      <span className="proj-pill" key={h}>
                        {h}
                      </span>
                    ))}
                  </div>
                ) : null}
              </figure>
              <div className="proj-body">
                {text.eyebrow && <p className="eyebrow">{text.eyebrow}</p>}
                <h3 className="proj-title">
                  {text.heading}
                  {text.headingEm ? (
                    <>
                      {" "}
                      <em>{text.headingEm}</em>
                    </>
                  ) : null}
                </h3>
                {text.specs && Object.values(text.specs).some(Boolean) && (
                  <ul className="proj-specs" aria-label="Key details">
                    {text.specs.beds && (
                      <li title="Bedrooms">
                        <BedDouble size={16} aria-hidden /> {text.specs.beds} <span>bed</span>
                      </li>
                    )}
                    {text.specs.baths && (
                      <li title="Bathrooms">
                        <Bath size={16} aria-hidden /> {text.specs.baths} <span>bath</span>
                      </li>
                    )}
                    {text.specs.parking && (
                      <li title="Car spaces">
                        <Car size={16} aria-hidden /> {text.specs.parking} <span>car</span>
                      </li>
                    )}
                    {text.specs.landM2 && (
                      <li title="Land size">
                        <LandPlot size={16} aria-hidden /> {text.specs.landM2} m² <span>land</span>
                      </li>
                    )}
                    {text.specs.buildM2 && (
                      <li title="Total floor area, as printed on the plan (may include garage and porch)">
                        <Ruler size={16} aria-hidden /> {text.specs.buildM2} m² <span>total</span>
                      </li>
                    )}
                  </ul>
                )}
                {text.price && (
                  <p className="proj-price">
                    <span>Price</span>
                    {text.price}
                  </p>
                )}
                {text.paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
                {text.bullets?.length ? (
                  <ul>
                    {text.bullets.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                ) : null}
                {cta && (
                  // A "Talk to Esi" to the buyer's agent page lands on its brief form itself (2026-10-31).
                  <SmartLink
                    className={/talk to esi/i.test(cta.label) ? "btn proj-btn proj-btn--esi" : "btn proj-btn"}
                    href={projectHref(cta.href, text.heading, text.headingEm)}
                  >
                    {/* Esi's photo on "Talk to Esi" (owner's choice, 2026-11-04); same button height. */}
                    {/talk to esi/i.test(cta.label) && (
                      <Image className="proj-btn-face" src="/brand/esi-dor.jpg" alt="" width={62} height={62} />
                    )}
                    {cta.label}
                  </SmartLink>
                )}
                {/*
                  Finance referral to Smart Loanz, an associated business (owner's request,
                  2026-10-31). The "subject to lender approval" line was removed from these cards at the owner's
                  request (2026-11-02).
                */}
                <div className="proj-loan">
                  <div className="proj-loan-copy">
                    <b>
                      Need a loan, <em>fast?</em>
                    </b>
                    <span>Talk to Smart Loanz, our associated broker.</span>
                  </div>
                  <a
                    className="proj-loan-btn"
                    href="https://www.smartloanz.com.au/book-online"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Book a free finance chat <span aria-hidden="true">&rarr;</span>
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
  );

  // The finder appears once projects carry finder data (area or type); otherwise the grid
  // renders exactly as before.
  const finderOn = items.some(({ text }) => text.area || text.kind);
  const uniq = (xs: (string | undefined)[]) => [...new Set(xs.filter((x): x is string => !!x))];
  return (
    <section className={`sec blk${finderOn ? " proj-sec--finder" : ""}`}>
      <div className="wrap">
        {finderOn ? (
          <ProjectFinder
            areas={uniq(items.map(({ text }) => text.area))}
            kinds={uniq(items.map(({ text }) => text.kind))}
          >
            {grid}
          </ProjectFinder>
        ) : (
          grid
        )}
      </div>
    </section>
  );
}

/** Blocks for one zone of a built-in page. */
export function Zone({ blocks, zone }: { blocks: Block[] | undefined; zone: string }) {
  const list = (blocks ?? []).filter((b) => (b.zone ?? "end") === zone);
  if (!list.length) return null;
  return (
    <>
      {list.map((b) => (
        <BlockView key={b.id} b={b} />
      ))}
    </>
  );
}

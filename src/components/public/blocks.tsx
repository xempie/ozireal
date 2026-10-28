import Image from "next/image";
import Link from "next/link";
import type { Block } from "@/lib/site-content";
import { GALLERY } from "@/lib/site-content";
import { FormSection } from "./forms/form-section";
import { ListingCard } from "./listing-card";
import { toCard } from "./listing-cards";
import { PageHero } from "./page-shell";
import { photo } from "./agency";
import { onMarket, soldAndLeased } from "@/server/public/listings";

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
      return (
        <section className={sectionClass(b)} style={sectionStyle(b)}>
          <div className="wrap">
            <Heading heading={b.heading} />
            <div className="benefit-grid">
              {b.items.map((c, i) =>
                c.href ? (
                  <SmartLink className="benefit blk-card-link" href={c.href} key={i}>
                    <h3>{c.title}</h3>
                    <p>{c.body}</p>
                  </SmartLink>
                ) : (
                  <div className="benefit" key={i}>
                    <h3>{c.title}</h3>
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
};

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
  return (
    <section className="sec blk">
      <div className="wrap">
        <div className="proj-grid">
          {items.map(({ image, text, cta }) => (
            <article className="proj" key={image.id}>
              <figure className="proj-fig">
                <Image
                  src={photo(image.image, 1000)}
                  alt={image.alt}
                  width={1000}
                  height={667}
                  sizes="(max-width: 900px) 100vw, 600px"
                />
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
                  <SmartLink className="btn proj-btn" href={cta.href}>
                    {cta.label}
                  </SmartLink>
                )}
              </div>
            </article>
          ))}
        </div>
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

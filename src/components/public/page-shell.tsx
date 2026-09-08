import Image from "next/image";
import Link from "next/link";
import { photo } from "./agency";
import type { ServicePage } from "./site-pages";

/**
 * The shell every standalone page shares: a compact hero, then the body.
 *
 * Deliberately not the home page's hero. That one is full-bleed, nearly a screen tall and
 * carries the "start here" strip, which is right for a landing page and wrong deeper in
 * the site, where the visitor has already arrived somewhere and wants the content. This
 * one is the same palette and type at about a third of the height.
 *
 * Server components throughout. Nothing on these pages is interactive except the
 * appraisal form, which brings its own client island.
 */

export function PageHero({
  eyebrow,
  title,
  titleEm,
  lede,
  image,
  imageAlt,
  facts,
}: {
  eyebrow: string;
  title: string;
  titleEm?: string;
  lede: string;
  image: string;
  imageAlt: string;
  facts?: string[];
}) {
  return (
    <header className="phero">
      <div className="phero-media">
        <Image
          src={photo(image, 1600)}
          alt={imageAlt}
          fill
          priority
          sizes="100vw"
          style={{ objectFit: "cover" }}
        />
      </div>
      <div className="wrap phero-inner">
        <p className="eyebrow">{eyebrow}</p>
        <h1>
          {title}
          {titleEm ? (
            <>
              {" "}
              <em>{titleEm}</em>
            </>
          ) : null}
        </h1>
        <p className="lede">{lede}</p>
        {facts && facts.length > 0 && (
          <div className="phero-facts">
            {facts.map((f) => (
              <span key={f}>{f}</span>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}

/** A heading and paragraphs, held to a readable measure. */
export function Prose({
  heading,
  body,
}: {
  heading: string;
  body: string[];
}) {
  return (
    <div className="prose">
      <h2>{heading}</h2>
      {body.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

/** The numbered list, reusing the home page's appraisal report styling. */
export function Points({ items, title }: { items: string[]; title: string }) {
  return (
    <div className="points">
      <h2 className="display">{title}</h2>
      <ul className="report">
        {items.map((p, i) => (
          <li key={p}>
            <em>{String(i + 1).padStart(2, "0")}</em> {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Closing band. Every page ends with somewhere to go. */
export function CtaBand({
  heading,
  headingEm,
  label,
  href,
}: {
  heading: string;
  headingEm?: string;
  label: string;
  href: string;
}) {
  return (
    <section className="sec sec--tight cta-band">
      <div className="wrap cta-band-inner">
        <h2 className="display">
          {heading}
          {headingEm ? (
            <>
              {" "}
              <em>{headingEm}</em>
            </>
          ) : null}
        </h2>
        <Link className="btn" href={href}>
          {label}
        </Link>
      </div>
    </section>
  );
}

/**
 * A whole service page from its data. The service pages differ only in content, so they
 * share one component and one layout rather than eight near-identical files.
 */
export function ServicePageBody({ page }: { page: ServicePage }) {
  return (
    <>
      <PageHero
        eyebrow={page.eyebrow}
        title={page.title}
        titleEm={page.titleEm}
        lede={page.lede}
        image={page.image}
        imageAlt={page.imageAlt}
        facts={page.facts}
      />

      <section className="sec">
        <div className="wrap page-cols">
          <Points title="What you get" items={page.points} />
          <div className="prose-stack">
            {page.sections.map((s) => (
              <Prose key={s.heading} heading={s.heading} body={s.body} />
            ))}
          </div>
        </div>
      </section>

      <CtaBand
        heading="Your property journey"
        headingEm="starts here."
        label={page.cta.label}
        href={page.cta.href}
      />
    </>
  );
}

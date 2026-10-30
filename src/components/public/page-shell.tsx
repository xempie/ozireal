import Image from "next/image";
import Link from "next/link";
import { photo } from "./agency";
import type { ServicePage } from "./site-pages";
import { formForSlug } from "./forms/definitions";
import { Icon } from "./icons";
import { extrasFor, type ServiceCard, type ServiceExtras } from "./service-extras";
import { Zone } from "./blocks";
import { Fixed } from "./fixed";
import { currentPageContent } from "@/server/public/content";

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

export async function PageHero({
  eyebrow: eyebrow0,
  title: title0,
  titleEm: titleEm0,
  lede: lede0,
  image,
  imageAlt,
  facts,
  noEdits,
}: {
  eyebrow: string;
  title: string;
  titleEm?: string;
  lede: string;
  image: string;
  imageAlt: string;
  facts?: string[];
  /** For a hero that is itself an edited block: no overrides, no zone. */
  noEdits?: boolean;
}) {
  /*
    Text edits from the website editor replace the page's own words, and blocks added
    "after the hero" render straight below it. Both come from the page being rendered,
    found by path, so no page has to pass anything in.
  */
  const doc = noEdits ? null : await currentPageContent();
  const h = doc?.hero ?? {};
  const eyebrow = h.eyebrow ?? eyebrow0;
  const title = h.title ?? title0;
  const titleEm = h.titleEm ?? titleEm0;
  const lede = h.lede ?? lede0;

  return (
    <>
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
    {!noEdits && <Zone blocks={doc?.blocks} zone="after_hero" />}
    </>
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
 * Three benefit cards. The first thing under the hero, because a visitor deciding whether
 * to read on is deciding on these rather than on a paragraph.
 */
function Benefits({ cards }: { cards: ServiceCard[] }) {
  return (
    <div className="benefit-grid">
      {cards.map((c) => (
        <div className="benefit" key={c.title}>
          <span className="benefit-icon">
            <Icon name={c.icon} />
          </span>
          <h3>{c.title}</h3>
          <p>{c.body}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * The block immediately above the form.
 *
 * Its job is to make filling the form the obvious next action, which means being concrete
 * about what arrives and what it costs to leave it. The `cost` line is the closest this
 * gets to urgency, and it is always a real consequence of the process rather than an
 * invented deadline: a vacant week, a stale campaign, an auction you were not registered
 * for. No countdown, no "limited places", nothing the agency would have to defend.
 */
function Pitch({ extras }: { extras: ServiceExtras }) {
  return (
    <section className="sec pitch">
      <div className="wrap pitch-layout">
        <div>
          <h2 className="display">
            {extras.pitch.heading} <em>{extras.pitch.headingEm}</em>
          </h2>
          <p className="lede">{extras.pitch.body}</p>
          <p className="pitch-cost">
            <Icon name="clock" />
            <span>{extras.pitch.cost}</span>
          </p>
        </div>
        <ul className="pitch-list">
          {extras.pitch.bullets.map((b) => (
            <li key={b}>
              <Icon name="check" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * A whole service page from its data. The service pages differ only in content, so they
 * share one component and one layout rather than a dozen near-identical files.
 *
 * The order is deliberate: what you get, why it matters, what it costs to wait, then the
 * form. `children` is where the page's own form goes, so the pitch sits directly above it
 * rather than being separated by a section the reader has to scroll past.
 */
export async function ServicePageBody({
  page: page0,
  children,
}: {
  page: ServicePage;
  children?: React.ReactNode;
}) {
  const extras = extrasFor(page0.slug);
  // Edited "what you get" points and prose sections, when the editor has changed them.
  const edits = (await currentPageContent())?.service;
  const page = {
    ...page0,
    points: edits?.points ?? page0.points,
    sections: edits?.sections ?? page0.sections,
  };

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

      {/*
        The enquiry form sits straight after the hero. Someone who arrived ready to ask
        should not have to scroll past the whole pitch to find where to do it; the
        benefits, points and gallery below are for the visitor still deciding.
      */}
      {children && <Fixed id="form">{children}</Fixed>}

      {extras && (
        <Fixed id="benefits">
          <section className="sec sec--tight">
            <div className="wrap">
              <Benefits cards={extras.cards} />
            </div>
          </section>
        </Fixed>
      )}

      <Fixed id="what-you-get">
        <section className="sec" style={{ background: "var(--paper-2)" }}>
          <div className="wrap page-cols">
            <Points title="What you get" items={page.points} />
            <div className="prose-stack">
              {page.sections.map((s) => (
                <Prose key={s.heading} heading={s.heading} body={s.body} />
              ))}
            </div>
          </div>
        </section>
      </Fixed>

      {/* The two-photo "gallery" band was removed site-wide on 2026-10-31 (owner's request). */}
      {extras && (
        <Fixed id="pitch">
          <Pitch extras={extras} />
        </Fixed>
      )}

      {/*
        No closing band when the page carries an enquiry form. The form IS the call to
        action, and the site footer already ends every page with one.
      */}
      {!formForSlug(page.slug) && (
        <Fixed id="closing-cta">
          <CtaBand
            heading="Not sure where to"
            headingEm="start?"
            label={page.cta.label}
            href={page.cta.href}
          />
        </Fixed>
      )}
    </>
  );
}

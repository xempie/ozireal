import Image from "next/image";
import Link from "next/link";
import { ListingsGrid } from "@/components/public/listings-grid";
import { toCard } from "@/components/public/listing-cards";
import { onMarket } from "@/server/public/listings";
import { publicSiteSettings } from "@/server/public/site";
import { PrincipalCard } from "@/components/public/principal";
import { ServiceGrid } from "@/components/public/service-grid";
import { FormSection } from "@/components/public/forms/form-section";
import { Zone } from "@/components/public/blocks";
import { pageContent } from "@/server/public/content";
import { Fixed } from "@/components/public/fixed";
import {
  AGENCY,
  HERO,
  JOURNEY,
  JOURNAL_POSTS,
  PROMISES,
  REPORTS,
  PARTNERS,
  TESTIMONIAL,
  WHY_US,
  photo,
} from "@/components/public/agency";

/**
 * The home page, built from www.ozirealty.com.au's own content.
 *
 * ## What this page used to claim
 *
 * It was assembled from a design template, and the template's numbers came with it: 412
 * properties sold, a 27-day median to contract, 98.6% occupancy, a ten-suburb medians
 * ticker, and a five-star testimonial from "Molly & Dan Rasheed" with 218 Google reviews
 * behind it. None of it was true, and all of it sat under RLA 350 628. Performance
 * figures an agency did not achieve, and a review it did not receive, are misleading
 * representations rather than placeholder copy.
 *
 * Every one is gone. The bands they occupied now carry things the agency actually says:
 *
 *   - the statistics band became the four offers from the live site (2.99%, 100 days
 *     risk-free, the $399 report, no middle man). Offers are the agency's own terms,
 *     which it may advertise; results are claims about the past, which it may not make
 *     without substantiation.
 *   - the medians ticker became "Your Property Journey Starts Here", the live site's row
 *     of destinations, which is real content in the same strip of design.
 *   - the testimonial is the one real quote on the live site, without the invented star
 *     average and review count beside it.
 *
 * The listing cards were the last invented content. Since 2026-09-30 they are the real
 * stock, read through src/server/public (rule 8).
 */

export default async function HomePage() {
  const [listed, site, doc] = await Promise.all([
    onMarket(6),
    publicSiteSettings(),
    pageContent("/"),
  ]);
  const advertised = listed.map(toCard);
  // Hero text edited in the website editor, falling back to the agency's own copy.
  const hero = {
    eyebrow: doc?.hero?.eyebrow ?? HERO.eyebrow,
    title: doc?.hero?.title ?? HERO.title,
    titleEm: doc?.hero?.titleEm ?? HERO.titleEm,
    lede: doc?.hero?.lede ?? HERO.lede,
  };

  return (
    <>
      {/* ============================================================ hero */}
      <header className="hero">
        <div className="hero-media">
          <Image
            src={photo("photo-1494526585095-c41746248156", 2000)}
            alt=""
            fill
            priority
            sizes="100vw"
            style={{ objectFit: "cover" }}
          />
        </div>

        <div className="hero-inner hero-inner--ticker">
          <div className="wrap">
            <div className="hero-copy">
              <p className="eyebrow">{hero.eyebrow}</p>
              <h1>
                {hero.title}{" "}
                <br />
                <em>{hero.titleEm}</em>
              </h1>
              <p className="lede">{hero.lede}</p>
            </div>
          </div>

          {/*
            The live site's row of destinations, in the strip the invented medians ticker
            used to occupy. Real links rather than a marquee, so it is navigation instead
            of decoration.
          */}
          <div className="journey" aria-label="Where to start">
            <div className="journey-label">Start here</div>
            <div className="journey-track">
              {JOURNEY.map((j) => (
                <Link className="journey-item" key={j.label} href={j.href}>
                  {j.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </header>

      <Zone blocks={doc?.blocks} zone="after_hero" />

      {/* ========================================================= services */}
      {/*
        The services as cards with icons, each landing on the page that carries that
        service's enquiry form. Straight after the hero (owner's request, 2026-10-29), so
        the first thing below the banner is what the office does.
      */}
      <Fixed id="services">
        <section className="sec" id="services" style={{ background: "var(--paper-2)" }}>
          <div className="wrap">
            <div className="sec-head">
              <div>
                <p className="eyebrow">What we do</p>
                <h2 className="display">
                  Eight services, <em>one office</em>
                </h2>
              </div>
              <Link className="txtlink" href="/property-services">
                All Adelaide property services <span aria-hidden="true">&rarr;</span>
              </Link>
            </div>
            <ServiceGrid />
          </div>
        </section>
      </Fixed>

      {/* The live home page's "Free book & Gift party" lead form, straight after the hero. */}
      <Fixed id="form">
        <FormSection slug="realestate-gift-adelaide" />
      </Fixed>

      {/* ========================================================= promises */}
      <Fixed id="promises">
        <section className="numbers">
          <div className="wrap">
            {PROMISES.map((n) => (
              <div className="num" key={n.caption}>
                <b>
                  {n.value}
                  {n.unit && <i>{n.unit}</i>}
                </b>
                <span>{n.caption}</span>
              </div>
            ))}
          </div>
        </section>
      </Fixed>

      {/* ========================================================= listings */}
      <Fixed id="listings">
        <section className="sec" id="listings">
          <div className="wrap">
            <div className="sec-head">
              <div>
                <p className="eyebrow">On the market</p>
                <h2 className="display">
                  Currently <em>advertised</em>
                </h2>
              </div>
              <Link className="txtlink" href="/for-sale">
                Every listing <span aria-hidden="true">&rarr;</span>
              </Link>
            </div>

            {/*
              Real stock (it was the template's invented cards until 2026-09-30). The filter
              chips are the agency's choice, set in the console's Website section.
            */}
            <ListingsGrid
              items={advertised}
              showFilters={site.homeListingFilters}
              empty={
                <p className="lede">
                  Nothing is advertised right now. New listings appear here as soon as they go
                  live, and the office usually knows what is coming.
                </p>
              }
            />
          </div>
        </section>
      </Fixed>

      {/* ========================================================== reports */}
      <Fixed id="reports">
        <section className="sec dark">
          <div className="wrap">
            <div className="sec-head">
              <div>
                <p className="eyebrow">Limited offer</p>
                <h2 className="display">
                  Free premium <em>appraisal report</em>
                </h2>
              </div>
              <p className="lede" style={{ margin: 0 }}>
                {REPORTS.appraisal.note}
              </p>
            </div>

            <div className="report-grid">
              {[REPORTS.appraisal, REPORTS.consultation, REPORTS.rental].map((r) => (
                <div className="report-card" key={r.title}>
                  <h3>{r.title}</h3>
                  <ul>
                    {r.items.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="report-cta">
              <Link className="btn" href="/free-property-appraisal-sa">
                Get my free report
              </Link>
              <Link className="txtlink" href="/free-suburb-insight-report">
                Free suburb insight report <span aria-hidden="true">&rarr;</span>
              </Link>
            </div>
          </div>
        </section>
      </Fixed>

      {/* =========================================================== why us */}
      <Fixed id="why-us">
        <section className="sec" id="why-us">
          <div className="wrap">
            <div className="sec-head">
              <div>
                <p className="eyebrow">Why work with us</p>
                <h2 className="display">
                  Exclusive, available, <em>flexible</em>
                </h2>
              </div>
            </div>

            <div className="why-grid">
              {WHY_US.map((g) => (
                <div className="why-card" key={g.name}>
                  <h3>{g.name}</h3>
                  <ul>
                    {g.points.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      </Fixed>

      {/* ========================================================= partners */}
      {/*
        "We Work With the Best" on the live site. Third-party marks the agency already
        publishes, rendered under that heading and nothing stronger: "we work with" is a
        different sentence from "endorsed by", and only one of them is a claim we could
        not substantiate.
      */}
      <Fixed id="partners">
        <section className="sec sec--tight partners">
          <div className="wrap">
            <p className="eyebrow solo">We work with the best</p>
            <div className="partner-row">
              {PARTNERS.map((b) => (
                <Image
                  key={b.name}
                  src={b.src}
                  alt={b.name}
                  width={b.w}
                  height={b.h}
                  sizes="160px"
                />
              ))}
            </div>
          </div>
        </section>
      </Fixed>

      {/* ============================================================ quote */}
      {/*
        One real quote, attributed as the live site attributes it. The template put a
        five-star average and a review count beside it; a rating is a representation about
        the business and needs a verifiable source, so it is not reproduced.
      */}
      <Fixed id="quote">
        <section className="sec sec--tight quote">
          <div className="wrap quote-layout">
            <div>
              <p className="eyebrow">What our clients say</p>
              <blockquote>{TESTIMONIAL.quote}</blockquote>
            </div>
            <div>
              <p className="quote-by">
                <b>{TESTIMONIAL.name}</b>
              </p>
            </div>
          </div>
        </section>
      </Fixed>

      {/* ========================================================== journal */}
      <Fixed id="journal">
        <section className="sec" id="journal">
          <div className="wrap">
            <div className="sec-head">
              <div>
                <p className="eyebrow">Journal</p>
                <h2 className="display">
                  Discover Australia&rsquo;s <em>property market</em>
                </h2>
              </div>
              <Link className="txtlink" href="/blog">
                Read the Adelaide property blog <span aria-hidden="true">&rarr;</span>
              </Link>
            </div>

            <div className="posts posts--two">
              {JOURNAL_POSTS.map((p) => (
                <article className="post" key={p.title}>
                  <div className="post-media">
                    <Image
                      src={p.src}
                      alt={p.alt}
                      width={924}
                      height={693}
                      sizes="(max-width: 640px) 100vw, 50vw"
                    />
                  </div>
                  <h3>{p.title}</h3>
                  <p>{p.excerpt}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </Fixed>

      {/* ===================================================== consultation */}
      <Fixed id="consultation">
        <section className="sec" style={{ background: "var(--paper-2)" }}>
          <div className="wrap">
            <div className="sec-head">
              <div>
                <p className="eyebrow">Free property strategy consultation</p>
                <h2 className="display">
                  Speak directly with <em>{AGENCY.principal}</em>
                </h2>
              </div>
              <p className="lede" style={{ margin: 0 }}>
                No pressure. Just clear, professional advice based on the South Australian
                market.
              </p>
            </div>
            <PrincipalCard cta={{ label: "Book a free consultation", href: "/book-online" }}>
              <p>
                Whether you are planning to sell, invest, or need professional property
                management, this one-on-one session gives you practical insight into your
                property&rsquo;s value, its rental potential, and the options in front of you.
              </p>
            </PrincipalCard>
          </div>
        </section>
      </Fixed>
    </>
  );
}

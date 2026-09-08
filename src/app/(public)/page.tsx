import Image from "next/image";
import Link from "next/link";
import { DemoListings } from "@/components/public/demo-listings";
import {
  AGENCY,
  HERO,
  JOURNEY,
  JOURNAL_POSTS,
  PROMISES,
  REPORTS,
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
 * The listing cards in `demo-data.ts` are the only invented content left, and they exist
 * because there is no stock in the database yet.
 */

export default function HomePage() {
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
              <p className="eyebrow">Adelaide &middot; South Australia</p>
              <h1>
                {HERO.title}
                <br />
                <em>{HERO.titleEm}</em>
              </h1>
              <p className="lede">{HERO.lede}</p>
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

      {/* ========================================================= promises */}
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

      {/* ========================================================= listings */}
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

          <DemoListings />
        </div>
      </section>

      {/* ========================================================== reports */}
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

      {/* =========================================================== why us */}
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

      {/* ============================================================ quote */}
      {/*
        One real quote, attributed as the live site attributes it. The template put a
        five-star average and a review count beside it; a rating is a representation about
        the business and needs a verifiable source, so it is not reproduced.
      */}
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

      {/* ========================================================== journal */}
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
              Read everything <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>

          <div className="posts posts--two">
            {JOURNAL_POSTS.map((p) => (
              <article className="post" key={p.title}>
                <div className="post-media">
                  <Image
                    src={photo(p.img, 800)}
                    alt={p.alt}
                    width={800}
                    height={500}
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

      {/* ===================================================== consultation */}
      <section className="sec" style={{ background: "var(--paper-2)" }}>
        <div className="wrap cta-band-inner">
          <div>
            <p className="eyebrow">Free property strategy consultation</p>
            <h2 className="display">
              Speak directly with <em>{AGENCY.principal}</em>
            </h2>
            <p className="lede">
              Principal of {AGENCY.name} ({AGENCY.licence}). No pressure, just clear,
              professional advice about your property.
            </p>
          </div>
          <Link className="btn" href="/book-online">
            Book a free consultation
          </Link>
        </div>
      </section>
    </>
  );
}

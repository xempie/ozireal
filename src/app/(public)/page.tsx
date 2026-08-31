import Image from "next/image";
import { DemoListings } from "@/components/public/demo-listings";
import { DemoAppraisalForm } from "@/components/public/demo-appraisal-form";
import {
  JOURNAL_POSTS,
  MEDIANS,
  SALES_FIGURES,
  SUBURB_CARDS,
  TESTIMONIAL,
  photo,
} from "@/components/public/demo-data";

/**
 * The home page, rendered from the supplied template's sample data.
 *
 * ## This page is currently disconnected on purpose
 *
 * It reads nothing. Every listing, median, statistic, suburb card and journal post comes
 * from `src/components/public/demo-data.ts`, which is plain constants — so the page can
 * be reviewed and signed off before any of it is committed to the database.
 *
 * It previously read real rows through `onMarket()`, `onMarketCount()` and
 * `soldAndLeased()`. Restoring that is a small diff and is the intended end state: swap
 * the demo imports back for `@/server/public/listings`, delete `demo-data.ts`, and move
 * the approved listings into `src/db/seed/fixtures`. Nothing about the read boundary has
 * changed in the meantime — `tests/public-boundary.test.ts` still forbids anything under
 * `(public)` from importing `@/db`, and this page imports no data layer at all.
 *
 * ## What is invented, and why it matters
 *
 * The 412 sales, the 27-day median, the 98.6% occupancy, the ten suburb medians and the
 * named five-star testimonial with its 218 review count are all from the template and
 * none of them are true. On a demo host that is fine. On a page carrying RLA 350 628 it
 * is a misleading representation about an agency's performance, so they must be replaced
 * with substantiated figures — or removed — before cutover to www.ozirealty.com.au.
 * `demo-data.ts` keeps them in one file so that is a deletion, not a hunt.
 */

export default function HomePage() {
  /* The ticker runs a marquee, so the set is printed twice and translated -50%. */
  const tickerSet = (
    <div className="ticker-set">
      {MEDIANS.map((m) => (
        <span className="tick" key={m.suburb}>
          {m.suburb} <b>{m.price}</b>{" "}
          <span className={m.up ? "up" : "dn"}>{m.move}</span>
        </span>
      ))}
    </div>
  );

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
              <p className="eyebrow">Adelaide · South Australia</p>
              <h1>
                Adelaide,
                <br />
                <em>street by street.</em>
              </h1>
              <p className="lede">
                We sell, lease and manage homes between Prospect and the sea. Last year
                that was 412 campaigns, 27 days to contract on average, and not one
                property listed by an agent who hadn&rsquo;t walked the street first.
              </p>
            </div>

            {/*
              The search panel is out for now. It is still built and still correct —
              <DemoSearch /> in demo-search.tsx — so putting it back is one line here.
              It comes back when /for-sale exists and it can submit somewhere real.
            */}
          </div>

          <div className="ticker" aria-label="Suburb median prices">
            <div className="ticker-label">Medians · 30 Aug</div>
            <div className="ticker-track" aria-hidden="true">
              {tickerSet}
              {tickerSet}
            </div>
          </div>
        </div>
      </header>

      {/* ======================================================== listings */}
      <section className="sec" id="listings">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <p className="eyebrow">On the market</p>
              <h2 className="display">
                Open <em>this weekend</em>
              </h2>
            </div>
            <span className="txtlink txtlink--flat">
              All 128 listings <span aria-hidden="true">&rarr;</span>
            </span>
          </div>

          <DemoListings />
        </div>
      </section>

      {/* ========================================================= numbers */}
      <section className="numbers">
        <div className="wrap">
          {SALES_FIGURES.map((n) => (
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

      {/* ======================================================== services */}
      <section className="sec dark" id="services">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <p className="eyebrow">What we do</p>
              <h2 className="display">
                Four things, <em>done properly</em>
              </h2>
            </div>
            <p className="lede" style={{ margin: 0 }}>
              Each of our agents carries a maximum of six live campaigns. It is the whole
              reason the numbers above look the way they do.
            </p>
          </div>

          <div className="svc-layout">
            <div className="svc-list">
              {/*
                <details>/<summary> rather than the template's click handler: the
                accordion works with JavaScript disabled, is keyboard operable for free,
                and its content is in the DOM for a crawler whether it is open or not.

                The shared `name` is what makes it exclusive — opening one panel closes
                the other three, which is what the template's JavaScript did by hand.
                It is a native browser behaviour, so it costs nothing and still needs no
                client component. A browser too old to know the attribute simply lets
                more than one sit open: the panels degrade to independent, never broken.
              */}
              <details className="svc" name="services" open>
                <summary className="svc-top">
                  <span className="svc-key">01 / SELL</span>
                  <span className="svc-name">Selling your home</span>
                  <span className="svc-plus" aria-hidden="true" />
                </summary>
                <div className="svc-panel-in">
                  <p>
                    A campaign built around your street, not a template. We price from
                    comparable sales you can read yourself, photograph in the light your
                    house actually gets, and give you a written buyer report every Monday
                    until it sells.
                  </p>
                  <div className="svc-meta">
                    <span>Auction or private treaty</span>
                    <span>No fee if unsold</span>
                  </div>
                  <a className="txtlink" href="#appraise">
                    Book an appraisal <span aria-hidden="true">&rarr;</span>
                  </a>
                </div>
              </details>

              <details className="svc" name="services">
                <summary className="svc-top">
                  <span className="svc-key">02 / MANAGE</span>
                  <span className="svc-name">Property management</span>
                  <span className="svc-plus" aria-hidden="true" />
                </summary>
                <div className="svc-panel-in">
                  <p>
                    2.99% capped, with routine inspections every quarter and photographs
                    attached to every report. One manager looks after your property from
                    the first advert to the final bond release — you will always know
                    their name.
                  </p>
                  <div className="svc-meta">
                    <span>From 2.99%</span>
                    <span>100-day trial</span>
                    <span>Max 90 properties per manager</span>
                  </div>
                  <a className="txtlink" href="#appraise">
                    Get a rent estimate <span aria-hidden="true">&rarr;</span>
                  </a>
                </div>
              </details>

              <details className="svc" name="services">
                <summary className="svc-top">
                  <span className="svc-key">03 / BUY</span>
                  <span className="svc-name">Buyer advocacy</span>
                  <span className="svc-plus" aria-hidden="true" />
                </summary>
                <div className="svc-panel-in">
                  <p>
                    For buyers who keep missing out. We shortlist against your brief,
                    inspect before you spend a Saturday on it, pull the sales history, and
                    bid on your behalf — including on the properties that never reach the
                    portals.
                  </p>
                  <div className="svc-meta">
                    <span>Fixed fee</span>
                    <span>Off-market access</span>
                  </div>
                  <a className="txtlink" href="#listings">
                    See how it works <span aria-hidden="true">&rarr;</span>
                  </a>
                </div>
              </details>

              <details className="svc" name="services">
                <summary className="svc-top">
                  <span className="svc-key">04 / INVEST</span>
                  <span className="svc-name">Investment &amp; land</span>
                  <span className="svc-plus" aria-hidden="true" />
                </summary>
                <div className="svc-panel-in">
                  <p>
                    Yield, vacancy and growth data for every suburb we work in, plus
                    subdivision advice for the deep blocks that are quietly worth twice
                    their listing. We will tell you when a deal does not stack up.
                  </p>
                  <div className="svc-meta">
                    <span>Suburb reports</span>
                    <span>Subdivision feasibility</span>
                  </div>
                  <a className="txtlink" href="#suburbs">
                    Browse suburbs <span aria-hidden="true">&rarr;</span>
                  </a>
                </div>
              </details>
            </div>

            <figure className="svc-figure">
              <Image
                src={photo("photo-1615873968403-89e068629265", 1200)}
                alt="Living room with tan leather sofa against a dark green wall"
                fill
                sizes="(max-width: 1080px) 100vw, 45vw"
                style={{ objectFit: "cover" }}
              />
              <figcaption>
                62 Sydenham Road, Norwood — sold 14 August, four days on market
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* ========================================================= suburbs */}
      <section className="sec" id="suburbs">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <p className="eyebrow">Where we work</p>
              <h2 className="display">
                Three suburbs we <em>know cold</em>
              </h2>
            </div>
            <span className="txtlink txtlink--flat">
              All 34 suburb reports <span aria-hidden="true">&rarr;</span>
            </span>
          </div>

          <div className="suburbs">
            {SUBURB_CARDS.map((s) => (
              <article className="sub" key={s.name}>
                <Image
                  src={photo(s.img, 900)}
                  alt={s.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1080px) 50vw, 33vw"
                  style={{ objectFit: "cover" }}
                />
                <div className="sub-body">
                  <h3>{s.name}</h3>
                  <p className="m">{s.meta}</p>
                  <div className="sub-stats">
                    <div>
                      <span>Median</span>
                      <b>{s.median}</b>
                    </div>
                    <div>
                      <span>12 mth</span>
                      <b className="up">{s.move}</b>
                    </div>
                    <div>
                      <span>Days</span>
                      <b>{s.days}</b>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ======================================================= appraisal */}
      <section className="sec" id="appraise" style={{ background: "var(--paper-2)" }}>
        <div className="wrap appraise">
          <figure className="appraise-fig">
            <Image
              src={photo("photo-1598928506311-c55ded91a20c", 1000)}
              alt="Living room with marble fireplace"
              fill
              sizes="(max-width: 1080px) 100vw, 40vw"
              style={{ objectFit: "cover" }}
            />
            <div className="appraise-badge">
              Turnaround<b>48 hours</b>
            </div>
          </figure>

          <div>
            <p className="eyebrow">Appraisal</p>
            <h2 className="display">
              What is your home <em>actually</em> worth?
            </h2>
            <p className="lede">
              Not an automated estimate. One of our agents walks through, then writes you
              a report you could hand to your accountant.
            </p>

            <ul className="report">
              <li>
                <em>01</em> A price range, with the six comparable sales it came from
              </li>
              <li>
                <em>02</em> Buyer demand for your street over the past ninety days
              </li>
              <li>
                <em>03</em> Rental yield, if you would rather hold than sell
              </li>
              <li>
                <em>04</em> The three jobs worth doing before you list — and what they
                return
              </li>
            </ul>

            <DemoAppraisalForm />
          </div>
        </div>
      </section>

      {/* =========================================================== quote */}
      <section className="sec sec--tight quote">
        <div className="wrap quote-layout">
          <div>
            <p className="eyebrow">Clients</p>
            <blockquote>
              {TESTIMONIAL.before}
              <em>{TESTIMONIAL.emphasis}</em>
              {TESTIMONIAL.after}
            </blockquote>
          </div>
          <div>
            <div className="stars" aria-hidden="true">
              ★★★★★
            </div>
            <p className="quote-by">
              <b>{TESTIMONIAL.name}</b>
              {TESTIMONIAL.detail}
              <br />
              {TESTIMONIAL.rating}
            </p>
          </div>
        </div>
      </section>

      {/* ========================================================= journal */}
      <section className="sec" id="journal">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <p className="eyebrow">Journal</p>
              <h2 className="display">
                Notes from the <em>Adelaide market</em>
              </h2>
            </div>
            <span className="txtlink txtlink--flat">
              Read everything <span aria-hidden="true">&rarr;</span>
            </span>
          </div>

          <div className="posts">
            {JOURNAL_POSTS.map((p) => (
              <article className="post" key={p.title}>
                <div className="post-media">
                  <Image
                    src={photo(p.img, 800)}
                    alt={p.alt}
                    width={800}
                    height={500}
                    sizes="(max-width: 640px) 100vw, (max-width: 1080px) 50vw, 33vw"
                  />
                </div>
                <h3>{p.title}</h3>
                <p>{p.excerpt}</p>
                <span className="meta">{p.meta}</span>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

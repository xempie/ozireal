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
  JOURNAL_POSTS,
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

const OFFERS = [
  {
    tag: "Limited offer",
    title: "Free Premium Appraisal Report (Valued at $399)",
    points: [
      "No obligation, no pressure",
      "Current market value range",
      "Comparable recent sales",
      "Buyer demand score",
      "Rental yield estimate",
      "Price-maximisation strategy",
      "Suburb growth outlook",
    ],
    cta: "Get My Free Appraisal",
    href: "/free-property-appraisal-sa#enquire",
    image: "photo-1583847268964-b28dc8f51f92",
    alt: "Living room with a large window",
  },
  {
    tag: null,
    title: "Book Your Free Property Consultation",
    points: [
      "Assess current market value",
      "Review recent sales in your area",
      "Analyse buyer and rental demand",
      "Identify ways to maximise your return",
      "Answer your key questions",
    ],
    cta: "Free Consultation",
    href: "/book-online#enquire",
    image: "photo-1570129477492-45c003edd2be",
    alt: "Sandstone villa with a return verandah",
  },
  {
    tag: "Free Suburb Insight Report",
    title: "Stay Ahead of the Next Market Shift",
    points: [
      "Median prices and recent sales trends",
      "Rental yields and vacancy rates",
      "Suburb growth performance",
      "Buyer and tenant demand levels",
      "Demographic and population insights",
      "School catchment zones",
      "Comparison with surrounding suburbs",
      "Comparable property analytics",
      "Market depth and buyer activity data",
      "Long-term capital growth trends",
      "Rental performance metrics",
      "Risk indicators and suburb volatility analysis",
      "And more …",
    ],
    cta: "Unlock My Suburb Insights",
    href: "/free-suburb-insight-report#enquire",
    image: "photo-1580587771525-78b9dba3b914",
    alt: "Terrace homes on a leafy street",
  },
  {
    tag: "Property Rental Report",
    title: "Smart Rent, Stable Income, Zero Guesswork",
    points: [
      "Accurate weekly rent range",
      "Comparable nearby rental results",
      "Vacancy & demand insights",
      "Tenant profile analysis",
      "Yield and annual income estimate",
      "Pricing strategy to minimise vacancy",
    ],
    cta: "Get Rent Report Now",
    href: "/property-rental-report#enquire",
    image: "photo-1600210491892-03d54c0aaf87",
    alt: "Apartment living room with a fireplace",
  },
] as const;

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

        <div className="hero-inner">
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

      {/* ====================================================== free offers */}
      {/*
        The four free reports and the consultation, each button landing on the form for
        it (#enquire is the FormSection anchor). Owner's content, 2026-10-29.
      */}
      <Fixed id="offers">
        <section className="sec" id="offers" style={{ background: "var(--paper-2)" }}>
          <div className="wrap">
            <div className="sec-head">
              <div>
                <p className="eyebrow">Free reports &amp; guidance</p>
                <h2 className="display">
                  Property value &amp; <em>strategy services</em>
                </h2>
              </div>
            </div>
            <div className="offer-list">
              {OFFERS.map((o, i) => (
                <article className={`offer${i % 2 ? " offer--flip" : ""}`} key={o.title}>
                  <div className="offer-media">
                    <Image
                      src={photo(o.image, 1200)}
                      alt={o.alt}
                      fill
                      sizes="(max-width: 900px) 100vw, 50vw"
                      style={{ objectFit: "cover" }}
                    />
                  </div>
                  <div className="offer-body">
                    {o.tag && <span className="offer-tag">{o.tag}</span>}
                    <h3>{o.title}</h3>
                    <ul className={`offer-points${o.points.length > 8 ? " offer-points--two" : ""}`}>
                      {o.points.map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                    <Link className="btn" href={o.href}>
                      {o.cta} <span aria-hidden="true">&rarr;</span>
                    </Link>
                  </div>
                </article>
              ))}
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

      {/* ============================================================= book */}
      {/*
        Esi Dor's free book, straight after the testimonials (which render in the
        "after:why-us" zone above). The form is the existing free-book form, so sign-ups
        reach the CRM through the same channel and consent wording as before.
      */}
      <Fixed id="book">
        <section className="sec dark book-sec" id="free-book">
          <div className="wrap book-layout">
            <div className="book-pitch">
              <div className="book-art">
                <div className="book-cover">
                  <Image
                    src="/brand/book-cover.png"
                    alt="Cover of 10 Truths About Finding The Right Home by Esi Dor"
                    width={603}
                    height={863}
                    sizes="(max-width: 560px) 60vw, 240px"
                  />
                </div>
              </div>
              <div>
                <p className="eyebrow">Free book</p>
                <h2 className="display">
                  10 truths about finding <em>the right home</em>
                </h2>
                <p className="book-byline">
                  By <b>Esi Dor</b>, Ozi Realty founder
                </p>
                <p className="lede">A guide to avoid common home buying traps.</p>
                <p className="book-tagline">
                  Because the right home isn&rsquo;t just found, it&rsquo;s understood.
                </p>
              </div>
            </div>
            <div className="book-form">
              <h3 className="book-form-title">Get your free copy</h3>
              <FormSection slug="realestate-gift-adelaide" bare />
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
            <div className="sec-head">
              <div>
                <p className="eyebrow">Our partners</p>
                <h2 className="display">
                  We work with <em>the best</em>
                </h2>
              </div>
            </div>
            <div className="partner-row">
              {PARTNERS.map((b) => (
                <Image
                  key={b.name}
                  src={b.src}
                  alt={b.name}
                  width={b.w}
                  height={b.h}
                  sizes="240px"
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
                No pressure. Just clear, professional guidance based on the South Australian
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

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
import { customPage, pageContent } from "@/server/public/content";
import { Fixed } from "@/components/public/fixed";
import { OfferDots } from "@/components/public/offer-dots";
import {
  AGENCY,
  HERO,
  JOURNAL_POSTS,
  PARTNERS,
  PORTRAIT,
  TESTIMONIAL,
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

/**
 * The four free offers, each led by the visitor's question (redesigned 2026-11-02). Three
 * points show; the rest open from "+ N more inside". `feat` is the highlighted card.
 */
const OFFERS = [
  {
    tag: "Valued at $399 · free",
    title: "What's my home worth?",
    sub: "Free Premium Appraisal Report",
    points: [
      "Current market value range",
      "Comparable recent sales",
      "Buyer demand score",
      "Rental yield estimate",
      "Price-maximisation strategy",
      "Suburb growth outlook",
      "No obligation, no pressure",
    ],
    cta: "Get my free appraisal",
    href: "/free-property-appraisal-sa#enquire",
    image: "photo-1583847268964-b28dc8f51f92",
    alt: "Living room with a large window",
    feat: true,
  },
  {
    tag: "One-on-one with Esi",
    title: "Not sure where to start?",
    sub: "Free Property Consultation",
    points: [
      "Assess current market value",
      "Review recent sales in your area",
      "Answer your key questions",
      "Analyse buyer and rental demand",
      "Identify ways to maximise your return",
    ],
    cta: "Book a free consultation",
    href: "/book-online#enquire",
    image: "photo-1570129477492-45c003edd2be",
    alt: "Sandstone villa with a return verandah",
    feat: false,
  },
  {
    tag: "Stay ahead of the market",
    title: "Where should I buy?",
    sub: "Free Suburb Insight Report",
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
      "And more",
    ],
    cta: "Unlock my suburb insights",
    href: "/free-suburb-insight-report#enquire",
    image: "photo-1580587771525-78b9dba3b914",
    alt: "Terrace homes on a leafy street",
    feat: false,
  },
  {
    tag: "For landlords",
    title: "What will it rent for?",
    sub: "Property Rental Report",
    points: [
      "Accurate weekly rent range",
      "Comparable nearby rental results",
      "Vacancy and demand insights",
      "Tenant profile analysis",
      "Yield and annual income estimate",
      "Pricing strategy to minimise vacancy",
    ],
    cta: "Get my rent report",
    href: "/property-rental-report#enquire",
    image: "photo-1600210491892-03d54c0aaf87",
    alt: "Apartment living room with a fireplace",
    feat: false,
  },
] as const;

/** "Exclusive, available, flexible": the agency's own points, three up front, bold key word. */
const WHY_CARDS = [
  {
    k: "Exclusive",
    tone: "orange",
    title: "Tailored to you, not a template",
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l3 6.5 7 .9-5.1 4.8 1.3 7-6.2-3.5-6.2 3.5 1.3-7L2 9.4l7-.9z" />
      </svg>
    ),
    points: [
      ["Personalised", " property search and targeting"],
      ["Data-driven", " insights for smarter decisions"],
      ["Digital marketing", " that attracts the right buyers"],
    ],
    more: ["Tailored real estate experience", "Expert support for buying, selling and investing", "Focused on measurable results"],
  },
  {
    k: "Available",
    tone: "blue",
    title: "Easy to reach, always in the loop",
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    points: [
      ["Fast, clear", " communication"],
      ["Timely updates", " at every stage"],
      ["Proactive", " problem solving"],
    ],
    more: ["Accurate market insights", "Strategic expert guidance", "A smooth, stress-free experience"],
  },
  {
    k: "Flexible",
    tone: "green",
    title: "Shaped around your schedule",
    icon: (
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
    points: [
      ["Virtual", " consultations available"],
      ["Evening", " showings available"],
      ["Customised", " negotiation strategies"],
    ],
    more: ["Every client has different goals", "We adapt to your schedule and preferences", "We tailor the process to fit you"],
  },
];

/** The projects the home page's New Homes band previews, in this order when present. */
const NEW_HOMES_PATH = "/new-homes-adelaide";
const NEW_HOMES_TEASERS = ["elizabeth-grove", "christies-beach", "mile-end"];

/**
 * Three project teasers read live from the New Homes page, so the band never disagrees
 * with it. No prices or counts (owner's request); the tag is "Ready now" or a highlight
 * that is neither the project type nor dated, so it cannot go stale.
 */
function newHomesTeasers(doc: Awaited<ReturnType<typeof customPage>>) {
  if (!doc) return [];
  const byId = new Map(doc.blocks.map((b) => [b.id, b]));
  const pick = (slug: string) => {
    const text = byId.get(`${slug}-text`);
    const image = byId.get(`${slug}-img`);
    if (text?.type !== "text" || image?.type !== "image" || !text.heading) return null;
    const tag = text.ready
      ? "Ready now"
      : text.highlights?.find(
          // Not the type again ("Apartments" restates "Apartment"), and nothing dated.
          (h) => !(text.kind && h.toLowerCase().startsWith(text.kind.toLowerCase())) && !/\d/.test(h),
        );
    return { slug, name: text.heading, kind: text.kind, tag, image: image.image, alt: image.alt };
  };
  return NEW_HOMES_TEASERS.map(pick).filter((t): t is NonNullable<typeof t> => t !== null);
}

export default async function HomePage() {
  const [listed, site, doc, newHomes] = await Promise.all([
    onMarket(6),
    publicSiteSettings(),
    pageContent("/"),
    customPage(NEW_HOMES_PATH),
  ]);
  const teasers = newHomesTeasers(newHomes);
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
                  Seven services, <em>one office</em>
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

      {/* ======================================================== new homes */}
      {/*
        The strongest route into the New Homes page (owner's request, 2026-10-31): high on
        the page, navy against the white sections either side, no numbers by request.
      */}
      <Fixed id="new-homes">
        <section className="nh-band">
          <div className="wrap nh-band-in">
            <div>
              <p className="eyebrow">New homes in Adelaide</p>
              <h2 className="display">
                Brand-new homes <em>across Adelaide and beyond.</em>
              </h2>
              <p className="nh-band-lede">
                House and land packages, townhouses and apartments, each with its price, grants
                and build timeline on show. Find one that fits, then talk to Esi.
              </p>
              <div className="nh-band-act">
                <Link className="btn nh-band-btn" href={NEW_HOMES_PATH}>
                  Browse new homes <span aria-hidden="true">&rarr;</span>
                </Link>
                <span className="nh-band-note">Filter by area, type and budget.</span>
              </div>
            </div>
            {teasers.length > 0 && (
              <div className="nh-teasers">
                {teasers.map((t) => (
                  <Link className="nh-teaser" href={NEW_HOMES_PATH} key={t.slug}>
                    <span className="nh-teaser-ph">
                      <Image src={photo(t.image, 240)} alt={t.alt} fill sizes="76px" style={{ objectFit: "cover" }} />
                      <i aria-hidden="true">Illustrative</i>
                    </span>
                    <span>
                      <span className="nh-teaser-name">{t.name}</span>
                      {t.kind && <span className="nh-teaser-kind">{t.kind}</span>}
                      {t.tag && <span className="nh-teaser-tag">{t.tag}</span>}
                    </span>
                  </Link>
                ))}
                <Link className="nh-more" href={NEW_HOMES_PATH}>
                  More projects on the New Homes page <span aria-hidden="true">&rarr;</span>
                </Link>
              </div>
            )}
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
              <Link className="txtlink" href="/all-listings">
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
            <div className="of-head">
              <div>
                <p className="eyebrow">Free reports &amp; guidance</p>
                <h2 className="display">
                  Know your numbers <em>before you decide.</em>
                </h2>
                <p className="of-lede">Four free, no-obligation reports. Pick the question you&rsquo;re weighing up.</p>
              </div>
              <span className="of-free">✓ All free · No obligation</span>
            </div>
            {/* Four across on desktop, two on tablets, a swipe row with dots on phones. */}
            <div className="of-track" id="of-track">
              {OFFERS.map((o) => (
                <article className={o.feat ? "of-card of-feat" : "of-card"} key={o.title}>
                  <div className="of-media">
                    <Image
                      src={photo(o.image, 800)}
                      alt={o.alt}
                      fill
                      sizes="(max-width: 760px) 84vw, (max-width: 960px) 50vw, 25vw"
                      style={{ objectFit: "cover" }}
                    />
                    <span className="of-tag">{o.tag}</span>
                  </div>
                  <div className="of-body">
                    <h3>{o.title}</h3>
                    <p className="of-sub">{o.sub}</p>
                    <ul className="of-points">
                      {o.points.slice(0, 3).map((p) => (
                        <li key={p}>{p}</li>
                      ))}
                    </ul>
                    {o.points.length > 3 && (
                      <details className="of-more">
                        <summary>+ {o.points.length - 3} more inside</summary>
                        <ul className="of-points">
                          {o.points.slice(3).map((p) => (
                            <li key={p}>{p}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                    <Link className="btn of-btn" href={o.href}>
                      {o.cta} <span aria-hidden="true">&rarr;</span>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
            <OfferDots count={OFFERS.length} trackId="of-track" />
          </div>
        </section>
      </Fixed>

      {/* =========================================================== why us */}
      <Fixed id="why-us">
        {/* Redesigned 2026-11-02: principal's quote, three promise cards, trust badges. */}
        <section className="sec wy" id="why-us">
          <div className="wrap">
            <div className="wy-top">
              <div>
                <p className="eyebrow">Why work with us</p>
                <h2 className="display">
                  Exclusive, available, <em>flexible.</em>
                </h2>
                <p className="wy-lede">
                  A small Adelaide office where the owner handles your property personally:
                  tailored to you, easy to reach, and shaped around your schedule.
                </p>
              </div>
              <div className="wy-esi">
                <Image className="sl-ph" src={PORTRAIT.src} alt={PORTRAIT.alt} width={128} height={128} />
                <div>
                  <q>You deal with me directly, from first call to settlement.</q>
                  <span>
                    {AGENCY.principal} · Founder and principal
                  </span>
                </div>
              </div>
            </div>

            <div className="wy-cards">
              {WHY_CARDS.map((c) => (
                <article className={`wy-card wy-card--${c.tone}`} key={c.k}>
                  <span className="wy-ic" aria-hidden="true">
                    {c.icon}
                  </span>
                  <p className="wy-k">{c.k}</p>
                  <h3>{c.title}</h3>
                  <ul>
                    {c.points.map(([b, rest]) => (
                      <li key={b + rest}>
                        <b>{b}</b>
                        {rest}
                      </li>
                    ))}
                  </ul>
                  <details className="wy-more">
                    <summary>+ {c.more.length} more</summary>
                    <p>{c.more.join(" · ")}</p>
                  </details>
                </article>
              ))}
            </div>

            <div className="wy-badges">
              {[
                ["Licensed agency", AGENCY.licence],
                ["Owner-run", "No middle man"],
                ["Trust account", "All client funds"],
                ["REISA standards", "How we operate"],
              ].map(([b, s]) => (
                <div className="wy-badge" key={b}>
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z" />
                    <path d="M8.5 12l2.5 2.5 4.5-5" />
                  </svg>
                  <span>
                    <b>{b}</b>
                    <small>{s}</small>
                  </span>
                </div>
              ))}
            </div>

            <div className="wy-act">
              <Link className="btn" href="/book-online#enquire">
                Book a free consultation &rarr;
              </Link>
              <a className="wy-call" href={AGENCY.mobileHref}>
                Or call Esi on {AGENCY.mobile}
              </a>
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
        {/* Redesigned 2026-11-02: the cover is the centrepiece, the form one strip below. */}
        <section className="sec bk" id="free-book">
          <div className="wrap">
            <div className="bk-top">
              <div className="bk-stage">
                <div className="bk-book">
                  <Image
                    src="/brand/book-cover.png"
                    alt="Cover of 10 Truths About Finding The Right Home by Esi Dor"
                    width={603}
                    height={863}
                    sizes="(max-width: 860px) 72vw, 340px"
                  />
                </div>
                <span className="bk-free" aria-hidden="true">
                  <span>
                    <b>Free</b>copy
                  </span>
                </span>
              </div>
              <div>
                <p className="eyebrow">Free book by Esi Dor</p>
                <h2 className="display">
                  10 truths about finding <em>the right home.</em>
                </h2>
                <p className="bk-by">
                  By <b>Esi Dor</b>, OziRealty founder
                </p>
                <ul className="bk-inside">
                  <li>A guide to avoid common home buying traps</li>
                  <li>Written from real Adelaide buying experience</li>
                  <li>Free, sent straight to your inbox</li>
                </ul>
                <p className="bk-quote">
                  Because the right home isn&rsquo;t just found, it&rsquo;s understood.
                </p>
              </div>
            </div>
            <div className="bk-strip">
              <h3 className="bk-strip-title">Get your free copy</h3>
              <FormSection
                slug="realestate-gift-adelaide"
                bare
                phone={AGENCY.mobile}
                phoneHref={AGENCY.mobileHref}
              />
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

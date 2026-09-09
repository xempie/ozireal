import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { PageHero, CtaBand } from "@/components/public/page-shell";
import { POSTS, readingMinutes, formatDate } from "@/components/public/posts";

/**
 * The journal index.
 *
 * `/blog` mirrors the live Wix path, and every card links to `/post/<slug>`, which is the
 * live post pattern kept verbatim. Between them that is every indexed blog URL surviving
 * cutover without a redirect.
 *
 * Every post is listed rather than paginated. Fifty-odd cards is a long page and still the
 * better experience at this size: one request, everything findable with the browser's own
 * search, and a crawler reaches every post from here without following a chain of "next"
 * links. Pagination earns its place at several hundred, not at fifty.
 */

export const metadata: Metadata = {
  title: "Journal",
  description:
    "Notes on the Adelaide property market from OziRealty: management fees, investment advice, appraisals, suburb analysis and what the numbers actually say.",
  alternates: { canonical: "/blog" },
};

export default function Page() {
  const [lead, ...rest] = POSTS;

  return (
    <>
      <PageHero
        eyebrow="Journal"
        title="Discover Australia's"
        titleEm="property market"
        lede="Notes from the Adelaide market, written by the people who work in it rather than commissioned to fill a content calendar."
        image="photo-1605276374104-dee2a0ed3cd6"
        imageAlt="Suburban house exterior"
        facts={[`${POSTS.length} posts`, "Written by the principal"]}
      />

      {lead && (
        <section className="sec">
          <div className="wrap">
            <Link className="post-lead" href={`/post/${lead.slug}`}>
              {lead.cover && (
                <div className="post-lead-media">
                  <Image
                    src={lead.cover}
                    alt={lead.coverAlt}
                    width={1200}
                    height={686}
                    priority
                    sizes="(max-width: 1080px) 100vw, 58vw"
                  />
                </div>
              )}
              <div className="post-lead-body">
                <p className="eyebrow">Latest</p>
                <h2>{lead.title}</h2>
                <p className="post-lead-excerpt">{lead.description}</p>
                <span className="meta">
                  {formatDate(lead.date)} &middot; {readingMinutes(lead)} min read
                </span>
              </div>
            </Link>
          </div>
        </section>
      )}

      <section className="sec" style={{ background: "var(--paper-2)" }}>
        <div className="wrap">
          <div className="sec-head">
            <div>
              <p className="eyebrow">Everything</p>
              <h2 className="display">
                All <em>{POSTS.length} posts</em>
              </h2>
            </div>
          </div>

          <div className="posts posts--three">
            {rest.map((p) => (
              <Link className="post" key={p.slug} href={`/post/${p.slug}`}>
                {p.cover && (
                  <div className="post-media">
                    <Image
                      src={p.cover}
                      alt={p.coverAlt}
                      width={800}
                      height={457}
                      sizes="(max-width: 640px) 100vw, (max-width: 1080px) 50vw, 33vw"
                    />
                  </div>
                )}
                <h3>{p.title}</h3>
                <p>{p.description}</p>
                <span className="meta">
                  {formatDate(p.date)} &middot; {readingMinutes(p)} min
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <CtaBand
        heading="Free appraisal,"
        headingEm="valued at $399."
        label="Get my free report"
        href="/free-property-appraisal-sa"
      />
    </>
  );
}

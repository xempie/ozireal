import Image from "next/image";
import Link from "next/link";
import { PageHero, CtaBand } from "./page-shell";
import { POSTS, postsForPage, pageCount, readingMinutes, formatDate } from "./posts";

/**
 * The journal index, for any page number.
 *
 * `/blog` and `/blog/page/<n>` render through here so the two routes cannot drift. Page 1
 * leads with the newest post at full width; later pages are a plain grid, because a "lead
 * post" on page 4 is just an inconsistently sized card.
 *
 * ## Paths, not a query string
 *
 * `/blog/page/2` rather than `/blog?page=2`. A path is prerenderable, unambiguous to a
 * crawler, and each page gets its own canonical. Query-string pagination is the version
 * that ends up with every page canonicalised to /blog and the archive dropping out of the
 * index.
 */

export function BlogList({ page }: { page: number }) {
  const total = pageCount();
  const posts = postsForPage(page);
  const isFirst = page === 1;
  const [lead, ...rest] = isFirst ? posts : [null, ...posts];

  return (
    <>
      <PageHero
        eyebrow="Journal"
        title="Adelaide property guidance,"
        titleEm="written by the agent"
        lede="Guides on selling, renting out, managing and investing in Adelaide property, from the person who does it rather than a content agency."
        image="photo-1605276374104-dee2a0ed3cd6"
        imageAlt="Suburban house exterior"
        facts={[
          `${POSTS.length} articles`,
          "South Australia",
          total > 1 ? `Page ${page} of ${total}` : "Updated regularly",
        ]}
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
              <p className="eyebrow">{isFirst ? "More reading" : `Page ${page}`}</p>
              {/*
                A heading that says what the archive is about, not how many rows are in
                it. "All 53 posts" describes the database; this describes the content, and
                it is the h2 a search engine reads under the h1.
              */}
              <h2 className="display">
                Selling, renting and <em>investing in Adelaide</em>
              </h2>
            </div>
          </div>

          <div className="posts posts--three">
            {rest.filter(Boolean).map((p) => (
              <Link className="post" key={p!.slug} href={`/post/${p!.slug}`}>
                {p!.cover && (
                  <div className="post-media">
                    <Image
                      src={p!.cover}
                      alt={p!.coverAlt}
                      width={800}
                      height={457}
                      sizes="(max-width: 640px) 100vw, (max-width: 1080px) 50vw, 33vw"
                    />
                  </div>
                )}
                <h3>{p!.title}</h3>
                <p>{p!.description}</p>
                <span className="meta">
                  {formatDate(p!.date)} &middot; {readingMinutes(p!)} min
                </span>
              </Link>
            ))}
          </div>

          {total > 1 && <Pagination page={page} total={total} />}
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

const href = (n: number) => (n === 1 ? "/blog" : `/blog/page/${n}`);

/**
 * Numbered, with the ends always reachable.
 *
 * A window around the current page plus the first and last, so a reader on page 2 can
 * jump to the oldest post without stepping through every page. The gaps are rendered as
 * inert spans rather than links, because an ellipsis that looks clickable and is not is
 * worse than one that plainly is not.
 */
function Pagination({ page, total }: { page: number; total: number }) {
  const window = new Set<number>([1, total, page, page - 1, page + 1]);
  const pages = [...window].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);

  return (
    <nav className="pager" aria-label="Journal pages">
      {page > 1 ? (
        <Link className="pager-step" href={href(page - 1)} rel="prev">
          <span aria-hidden="true">&larr;</span> Newer
        </Link>
      ) : (
        <span className="pager-step pager-step--off">
          <span aria-hidden="true">&larr;</span> Newer
        </span>
      )}

      <ol className="pager-nums">
        {pages.map((n, i) => (
          <li key={n}>
            {i > 0 && pages[i - 1] !== n - 1 && <span className="pager-gap">&hellip;</span>}
            {n === page ? (
              <span className="pager-num pager-num--on" aria-current="page">
                {n}
              </span>
            ) : (
              <Link className="pager-num" href={href(n)}>
                {n}
              </Link>
            )}
          </li>
        ))}
      </ol>

      {page < total ? (
        <Link className="pager-step" href={href(page + 1)} rel="next">
          Older <span aria-hidden="true">&rarr;</span>
        </Link>
      ) : (
        <span className="pager-step pager-step--off">
          Older <span aria-hidden="true">&rarr;</span>
        </span>
      )}
    </nav>
  );
}

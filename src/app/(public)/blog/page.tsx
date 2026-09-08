import type { Metadata } from "next";
import Image from "next/image";
import { PageHero, CtaBand } from "@/components/public/page-shell";
import { JOURNAL_POSTS } from "@/components/public/agency";

/**
 * The journal.
 *
 * `/blog` mirrors the live Wix path exactly. So does the post pattern it will link to:
 * `docs/legacy-site.md` is emphatic that `/post/<slug>` is kept verbatim, because
 * preserving 51 indexed URLs is worth far more than a tidier path.
 *
 * The posts here are the template's three. The real 51 are a content migration out of
 * Wix (2B.9a) and the individual `/post/<slug>` routes land with them, which is why
 * nothing on this page links to a post yet.
 */

export const metadata: Metadata = {
  title: "Journal",
  description:
    "Notes from the Adelaide market. What property management actually costs, when a deep block is worth subdividing, and why local auctions clear faster.",
  alternates: { canonical: "/blog" },
};

export default function Page() {
  return (
    <>
      <PageHero
        eyebrow="Journal"
        title="Notes from the"
        titleEm="Adelaide market"
        lede="Discover Australia's property market. Notes on management fees, investment advice and what the numbers actually say."
        image="photo-1605276374104-dee2a0ed3cd6"
        imageAlt="Suburban house exterior"
        facts={["Written by the principal", "No sponsored posts"]}
      />

      <section className="sec">
        <div className="wrap">
          <div className="posts posts--two">
            {JOURNAL_POSTS.map((p) => (
              <article className="post" key={p.title}>
                <div className="post-media">
                  <Image
                    src={p.src}
                    alt={p.alt}
                    width={924}
                    height={693}
                    sizes="(max-width: 640px) 100vw, (max-width: 1080px) 50vw, 33vw"
                  />
                </div>
                <h3>{p.title}</h3>
                <p>{p.excerpt}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <CtaBand
        heading="Your property journey"
        headingEm="starts here."
        label="Talk to the office"
        href="/contact"
      />
    </>
  );
}

import { PageHero } from "./page-shell";
import { BlogFilter, type BlogCard } from "./blog-filter";
import { POSTS, TOPICS, formatDate, postHref, readingMinutes, topicLabel, topicsOf } from "./posts";

/**
 * The journal index: /blog, and /blog/topic/<key> with that topic pre-selected.
 *
 * Rebuilt 2026-10-31: the whole archive on one page behind a search, topic and sort
 * filter, every card tagged, and no appraisal band at the foot (owner's request). The
 * old /blog/page/<n> pages redirect here.
 */

export function BlogList({ topic }: { topic?: string } = {}) {
  const cards: BlogCard[] = POSTS.map((p) => ({
    href: postHref(p),
    title: p.title,
    description: p.description,
    cover: p.cover,
    coverAlt: p.coverAlt,
    date: p.date,
    dateLabel: formatDate(p.date),
    minutes: readingMinutes(p),
    topics: topicsOf(p).map((k) => ({ key: k, label: topicLabel(k) })),
  }));

  return (
    <>
      {/* Hides the footer's appraisal banner on the journal (owner's request, 2026-10-31). */}
      <span className="no-foot-cta" hidden />
      <PageHero
        eyebrow="Journal"
        title={topic ? `${topicLabel(topic)} in Adelaide:` : "Adelaide property guides,"}
        titleEm={topic ? "guides and tips" : "tips and market insights"}
        lede="Practical guides on selling, buying, renting out, managing and investing in Adelaide and South Australian property."
        image="photo-1605276374104-dee2a0ed3cd6"
        imageAlt="Suburban house exterior"
        facts={[`${POSTS.length} guides`, "South Australia", "Updated regularly"]}
      />
      <BlogFilter
        cards={cards}
        topics={TOPICS.map((t) => ({ key: t.key, label: t.label }))}
        initialTopic={topic}
      />
    </>
  );
}

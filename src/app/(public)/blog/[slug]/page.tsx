import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  POSTS,
  formatDate,
  postBySeoSlug,
  postHref,
  readingMinutes,
  seoSlug,
  topicLabel,
  topicsOf,
} from "@/components/public/posts";

/**
 * One blog post, at /blog/<slug> since 2026-10-31 (owner's request, for search).
 *
 * The old Wix address /post/<wix-slug> permanently redirects here (see
 * app/(public)/post/[slug]); long Wix slugs were shortened in posts.ts SEO_SLUGS.
 * Topic tags close the article, and the appraisal band that used to follow it is gone.
 *
 * generateStaticParams prerenders every post; dynamicParams=false makes an unknown slug a
 * 404. The static /blog/page and /blog/topic segments win over this dynamic one.
 */

export const dynamicParams = false;

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: seoSlug(p) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = postBySeoSlug(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: postHref(post) },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      publishedTime: post.date || undefined,
      images: post.cover ? [post.cover] : undefined,
    },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = postBySeoSlug(slug);
  if (!post) notFound();

  const more = POSTS.filter((p) => p.slug !== post.slug).slice(0, 3);

  return (
    <>
      {/* Hides the footer's appraisal banner on every post (owner's request, 2026-10-31). */}
      <span className="no-foot-cta" hidden />
      <article className="post-page">
        <header className="post-head">
          <div className="wrap">
            <Link className="post-back" href="/blog">
              <span aria-hidden="true">&larr;</span> Journal
            </Link>
            <h1>{post.title}</h1>
            <p className="post-meta">
              {post.author}
              {post.date && <> &middot; {formatDate(post.date)}</>} &middot;{" "}
              {readingMinutes(post)} min read
            </p>
          </div>
        </header>

        {post.cover && (
          <div className="wrap">
            <div className="post-cover">
              <Image
                src={post.cover}
                alt={post.coverAlt}
                width={1200}
                height={686}
                priority
                sizes="(max-width: 1080px) 100vw, 1000px"
              />
            </div>
          </div>
        )}

        <div className="wrap">
          <div className="post-body">
            {post.blocks.map((b, i) => {
              if (b.t === "h2") return <h2 key={i}>{b.text}</h2>;
              if (b.t === "h3") return <h3 key={i}>{b.text}</h3>;
              if (b.t === "ul")
                return (
                  <ul key={i}>
                    {b.items?.map((it, j) => (
                      <li key={j}>{it}</li>
                    ))}
                  </ul>
                );
              return <p key={i}>{b.text}</p>;
            })}

            <p className="post-topics">
              Topics:{" "}
              {topicsOf(post).map((k) => (
                <Link key={k} className="bf-tag" href={`/blog/topic/${k}`}>
                  {topicLabel(k)}
                </Link>
              ))}
            </p>
          </div>
        </div>
      </article>

      {more.length > 0 && (
        <section className="sec" style={{ background: "var(--paper-2)" }}>
          <div className="wrap">
            <div className="sec-head">
              <div>
                <p className="eyebrow">Keep reading</p>
                <h2 className="display">
                  More from the <em>journal</em>
                </h2>
              </div>
              <Link className="txtlink" href="/blog">
                Every post <span aria-hidden="true">&rarr;</span>
              </Link>
            </div>
            <div className="posts posts--three">
              {more.map((p) => (
                <Link className="post" key={p.slug} href={postHref(p)}>
                  {p.cover && (
                    <div className="post-media">
                      <Image src={p.cover} alt={p.coverAlt} width={800} height={457} sizes="(max-width: 640px) 100vw, 33vw" />
                    </div>
                  )}
                  <h3>{p.title}</h3>
                  <span className="meta">
                    {formatDate(p.date)} &middot; {readingMinutes(p)} min
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

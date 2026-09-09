import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CtaBand } from "@/components/public/page-shell";
import { POSTS, postBySlug, readingMinutes, formatDate } from "@/components/public/posts";

/**
 * One blog post.
 *
 * `/post/<slug>` is the live site's pattern, kept verbatim. `docs/legacy-site.md` rule 3
 * is explicit: adopting it means 54 indexed URLs need no redirect at all, which is worth
 * far more than a tidier path.
 *
 * generateStaticParams prerenders every post, so the blog is static HTML with no query
 * behind it. dynamicParams=false makes an unknown slug a 404 rather than an attempt to
 * render a post that does not exist.
 */

export const dynamicParams = false;

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = postBySlug(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/post/${post.slug}` },
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
  const post = postBySlug(slug);
  if (!post) notFound();

  const more = POSTS.filter((p) => p.slug !== post.slug).slice(0, 3);

  return (
    <>
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
                <Link className="post" key={p.slug} href={`/post/${p.slug}`}>
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

      <CtaBand
        heading="Free appraisal,"
        headingEm="valued at $399."
        label="Get my free report"
        href="/free-property-appraisal-sa"
      />
    </>
  );
}

import { notFound, permanentRedirect } from "next/navigation";
import { POSTS, postBySlug, postHref } from "@/components/public/posts";

/**
 * The old Wix address, /post/<wix-slug>. Posts moved to /blog/<slug> on 2026-10-31;
 * this permanently redirects (308, which search engines treat as a 301) so every indexed
 * URL and backlink lands on the new one.
 */

export const dynamicParams = false;

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const post = postBySlug((await params).slug);
  if (!post) notFound();
  permanentRedirect(postHref(post));
}

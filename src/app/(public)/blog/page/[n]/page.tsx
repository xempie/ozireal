import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogList } from "@/components/public/blog-list";
import { pageCount } from "@/components/public/posts";

/**
 * The journal, pages two and up.
 *
 * A path rather than `?page=2`: it prerenders, it is unambiguous to a crawler, and each
 * page carries its own canonical. Query-string pagination is the version where every page
 * ends up canonicalised to /blog and the archive quietly leaves the index.
 *
 * Page 1 is NOT generated here. It lives at /blog, and `/blog/page/1` would be a second
 * URL for the same content, which is the duplicate this scheme exists to avoid.
 */

export const dynamicParams = false;

export function generateStaticParams() {
  const total = pageCount();
  return Array.from({ length: Math.max(0, total - 1) }, (_, i) => ({ n: String(i + 2) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ n: string }>;
}): Promise<Metadata> {
  const { n } = await params;
  return {
    title: `Adelaide Property Tips and Guides, page ${n}`,
    description:
      "More guides on selling, renting out, managing and investing in Adelaide property, written by the agent who does it.",
    alternates: { canonical: `/blog/page/${n}` },
    /* Deeper pages are navigation rather than destinations; the posts are what should rank. */
    robots: { index: false, follow: true },
  };
}

export default async function Page({ params }: { params: Promise<{ n: string }> }) {
  const { n } = await params;
  const page = Number(n);
  if (!Number.isInteger(page) || page < 2 || page > pageCount()) notFound();
  return <BlogList page={page} />;
}

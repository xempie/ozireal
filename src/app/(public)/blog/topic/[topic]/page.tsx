import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogList } from "@/components/public/blog-list";
import { TOPICS, topicLabel } from "@/components/public/posts";

/** One indexable page per journal topic, with that topic pre-selected in the filter. */

export const dynamicParams = false;

export function generateStaticParams() {
  return TOPICS.map((t) => ({ topic: t.key }));
}

export async function generateMetadata({ params }: { params: Promise<{ topic: string }> }): Promise<Metadata> {
  const { topic } = await params;
  const label = topicLabel(topic);
  return {
    title: `${label} in Adelaide: Guides and Tips`,
    description: `Practical ${label.toLowerCase()} guides for Adelaide and South Australian property owners, buyers and investors.`,
    alternates: { canonical: `/blog/topic/${topic}` },
  };
}

export default async function Page({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params;
  if (!TOPICS.some((t) => t.key === topic)) notFound();
  return <BlogList topic={topic} />;
}

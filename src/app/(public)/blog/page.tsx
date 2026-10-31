import type { Metadata } from "next";
import { BlogList } from "@/components/public/blog-list";

/**
 * The journal, page one.
 *
 * `/blog` mirrors the live Wix path. Posts live at `/blog/<slug>` since 2026-10-31, and the
 * old `/post/<slug>` addresses permanently redirect there.
 */

export const metadata: Metadata = {
  /*
    A title about the content, not about the archive. "All 53 posts" describes the row
    count; this describes what somebody searching would be looking for, which is the job
    a title tag is actually doing.
  */
  title: "Adelaide Property Tips, Guides and Market Insights",
  description:
    "Practical guides on selling, renting out, managing and investing in Adelaide property. Search by topic: property management, selling, appraisals, buying, investment and suburbs.",
  alternates: { canonical: "/blog" },
};

export default function Page() {
  return <BlogList />;
}

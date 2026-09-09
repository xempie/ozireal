import type { Metadata } from "next";
import { BlogList } from "@/components/public/blog-list";

/**
 * The journal, page one.
 *
 * `/blog` mirrors the live Wix path, and every card links to `/post/<slug>`, which is the
 * live post pattern kept verbatim. Between them every indexed blog URL survives cutover
 * without a redirect.
 *
 * Pages two and up live at `/blog/page/<n>`; both routes render the same component so
 * they cannot drift apart.
 */

export const metadata: Metadata = {
  /*
    A title about the content, not about the archive. "All 53 posts" describes the row
    count; this describes what somebody searching would be looking for, which is the job
    a title tag is actually doing.
  */
  title: "Adelaide Property Advice, Guides and Market Insights",
  description:
    "Practical guides on selling, renting out, managing and investing in Adelaide property, written by the agent who does it. Fees, appraisals, suburbs and what the numbers mean.",
  alternates: { canonical: "/blog" },
};

export default function Page() {
  return <BlogList page={1} />;
}

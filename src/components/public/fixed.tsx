import { Zone } from "./blocks";
import { currentPageContent } from "@/server/public/content";

/**
 * One built-in section of a page, made controllable from the website editor: hidden
 * when the page's edits say so, with any blocks placed "before:<id>" or "after:<id>"
 * rendered around it. Renders no element of its own, so wrapping a section changes
 * nothing about its markup or styling. The ids are listed in src/lib/fixed-sections.ts.
 */
export async function Fixed({ id, children }: { id: string; children: React.ReactNode }) {
  const doc = await currentPageContent();
  const hidden = doc?.hidden?.includes(id) ?? false;
  return (
    <>
      <Zone blocks={doc?.blocks} zone={`before:${id}`} />
      {!hidden && children}
      <Zone blocks={doc?.blocks} zone={`after:${id}`} />
    </>
  );
}

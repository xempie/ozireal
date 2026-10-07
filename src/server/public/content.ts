import { cache } from "react";
import { draftMode, headers } from "next/headers";
import { and, eq, inArray, sql } from "drizzle-orm";
import { siteContent } from "@/db/schema";
import {
  PageDocSchema,
  ThemeDocSchema,
  THEME_PATH,
  isBuiltinPath,
  type PageDoc,
  type ThemeDoc,
} from "@/lib/site-content";
import { publicQuery } from "./tenant";

/**
 * Website content edits, as the public site may see them (rule 8).
 *
 * Returns only the parsed doc: never the row, its author or its notes. The published
 * version normally; the draft instead when draft mode is on, which only the console's
 * signed-in preview route can switch on (/api/website/preview).
 *
 * A doc that fails the schema renders as if there were no edits, so a bad write can
 * never take a page down.
 */

/** The current request's path, forwarded by the middleware as x-pathname. */
export const currentPath = cache(async (): Promise<string> => {
  const h = await headers();
  return h.get("x-pathname") ?? "/";
});

export const isPreview = cache(async (): Promise<boolean> => {
  try {
    return (await draftMode()).isEnabled;
  } catch {
    return false;
  }
});

const rawDoc = cache(async (path: string, preview: boolean): Promise<unknown | null> => {
  try {
    const rows = await publicQuery((tx) =>
      tx
        .select({ doc: siteContent.doc, status: siteContent.status })
        .from(siteContent)
        .where(
          and(
            eq(siteContent.path, path),
            inArray(siteContent.status, preview ? ["draft", "published"] : ["published"]),
          ),
        )
        .orderBy(sql`case ${siteContent.status} when 'draft' then 0 else 1 end`)
        .limit(1),
    );
    return rows[0]?.doc ?? null;
  } catch (e) {
    // The site must render without its edits rather than not at all.
    console.error("[content] read failed:", e instanceof Error ? e.message : e);
    return null;
  }
});

/** The page's edits, or null when it has none. */
export async function pageContent(path: string): Promise<PageDoc | null> {
  const raw = await rawDoc(path, await isPreview());
  if (!raw) return null;
  const parsed = PageDocSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** The edits for the page being rendered right now. */
export async function currentPageContent(): Promise<PageDoc | null> {
  return pageContent(await currentPath());
}

export async function themeContent(): Promise<ThemeDoc | null> {
  const raw = await rawDoc(THEME_PATH, await isPreview());
  if (!raw) return null;
  const parsed = ThemeDocSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** A page created in the console, when it exists and is not taken down. */
export async function customPage(path: string): Promise<PageDoc | null> {
  if (isBuiltinPath(path)) return null;
  const doc = await pageContent(path);
  return doc && !doc.deleted ? doc : null;
}

/** Published new pages, for the sitemap. */
export async function publishedCustomPaths(): Promise<string[]> {
  try {
    const rows = await publicQuery((tx) =>
      tx
        .select({ path: siteContent.path, doc: siteContent.doc })
        .from(siteContent)
        .where(eq(siteContent.status, "published")),
    );
    return rows
      .filter((r) => r.path.startsWith("/") && !isBuiltinPath(r.path))
      .filter((r) => {
        const d = PageDocSchema.safeParse(r.doc);
        return d.success && !d.data.deleted;
      })
      .map((r) => r.path);
  } catch {
    return [];
  }
}

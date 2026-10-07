import { and, desc, eq, inArray } from "drizzle-orm";
import { query } from "@/db";
import { siteContent } from "@/db/schema";
import {
  BUILTIN_PAGES,
  LOCKED_PATHS,
  PageDocSchema,
  THEME_PATH,
  ThemeDocSchema,
  isBuiltinPath,
  type PageDoc,
  type ThemeDoc,
} from "@/lib/site-content";

/**
 * The website editor's view of site_content, for the console and the assistant.
 */

export type SitePageRow = {
  path: string;
  label: string;
  builtin: boolean;
  locked: boolean;
  hasDraft: boolean;
  draftAt: Date | null;
  publishedAt: Date | null;
  /** A new page taken down (its latest version is marked deleted). */
  deleted: boolean;
  /** Added blocks and text edits in the version that would show in preview. */
  editCount: number;
};

function editCount(doc: PageDoc | null) {
  if (!doc) return 0;
  return (
    doc.blocks.length +
    Object.keys(doc.hero ?? {}).length +
    Object.keys(doc.service ?? {}).length +
    Object.keys(doc.meta ?? {}).length +
    (doc.hidden?.length ?? 0)
  );
}

const parsePage = (raw: unknown): PageDoc | null => {
  const p = PageDocSchema.safeParse(raw);
  return p.success ? p.data : null;
};

/** Every page: the built-in ones, then pages created in the editor. */
export async function getSitePages(): Promise<SitePageRow[]> {
  const rows = await query((tx) =>
    tx
      .select({
        path: siteContent.path,
        status: siteContent.status,
        doc: siteContent.doc,
        createdAt: siteContent.createdAt,
        publishedAt: siteContent.publishedAt,
      })
      .from(siteContent)
      .where(inArray(siteContent.status, ["draft", "published"])),
  );

  const byPath = new Map<string, { draft?: (typeof rows)[number]; published?: (typeof rows)[number] }>();
  for (const r of rows) {
    if (r.path === THEME_PATH) continue;
    const e = byPath.get(r.path) ?? {};
    if (r.status === "draft") e.draft = r;
    else e.published = r;
    byPath.set(r.path, e);
  }

  const row = (path: string, label: string, builtin: boolean): SitePageRow => {
    const e = byPath.get(path) ?? {};
    const current = parsePage((e.draft ?? e.published)?.doc);
    const firstHero = current?.blocks.find((b) => b.type === "hero");
    return {
      path,
      label: builtin ? label : current?.meta?.title ?? (firstHero?.type === "hero" ? firstHero.title : path),
      builtin,
      locked: LOCKED_PATHS.includes(path),
      hasDraft: !!e.draft,
      draftAt: e.draft?.createdAt ?? null,
      publishedAt: e.published?.publishedAt ?? null,
      deleted: !!current?.deleted,
      editCount: editCount(current),
    };
  };

  const builtin = BUILTIN_PAGES.map((b) => row(b.path, b.label, true));
  const custom = [...byPath.keys()]
    .filter((p) => !isBuiltinPath(p))
    .sort()
    .map((p) => row(p, p, false));
  return [...custom, ...builtin];
}

/** The doc the editor works on: the draft if there is one, else what is published. */
export async function getWorkingPage(path: string): Promise<{ doc: PageDoc | null; state: "draft" | "published" | "none" }> {
  const rows = await query((tx) =>
    tx
      .select({ status: siteContent.status, doc: siteContent.doc })
      .from(siteContent)
      .where(and(eq(siteContent.path, path), inArray(siteContent.status, ["draft", "published"]))),
  );
  const draft = rows.find((r) => r.status === "draft");
  const pub = rows.find((r) => r.status === "published");
  if (draft) return { doc: parsePage(draft.doc), state: "draft" };
  if (pub) return { doc: parsePage(pub.doc), state: "published" };
  return { doc: null, state: "none" };
}

export async function getWorkingTheme(): Promise<{ theme: ThemeDoc; hasDraft: boolean; publishedAt: Date | null }> {
  const rows = await query((tx) =>
    tx
      .select({ status: siteContent.status, doc: siteContent.doc, publishedAt: siteContent.publishedAt })
      .from(siteContent)
      .where(and(eq(siteContent.path, THEME_PATH), inArray(siteContent.status, ["draft", "published"]))),
  );
  const draft = rows.find((r) => r.status === "draft");
  const pub = rows.find((r) => r.status === "published");
  const parsed = ThemeDocSchema.safeParse((draft ?? pub)?.doc ?? {});
  return {
    theme: parsed.success ? parsed.data : {},
    hasDraft: !!draft,
    publishedAt: pub?.publishedAt ?? null,
  };
}

/** Published and archived versions of one path, newest first. */
export async function getSiteHistory(path: string) {
  return query((tx) =>
    tx
      .select({
        id: siteContent.id,
        version: siteContent.version,
        status: siteContent.status,
        note: siteContent.note,
        createdBy: siteContent.createdBy,
        publishedAt: siteContent.publishedAt,
      })
      .from(siteContent)
      .where(and(eq(siteContent.path, path), inArray(siteContent.status, ["published", "archived"])))
      .orderBy(desc(siteContent.version))
      .limit(20),
  );
}

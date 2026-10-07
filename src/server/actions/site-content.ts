"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { defineAction, ActionError, type ActionContext } from "./action";
import { siteContent } from "@/db/schema";
import { servicePageBySlug } from "@/components/public/site-pages";
import {
  BlockSchema,
  HeroTextSchema,
  LOCKED_PATHS,
  PageDocSchema,
  ServiceTextSchema,
  THEME_PATH,
  ThemeDocSchema,
  isBuiltinPath,
  newBlockId,
  newPagePathProblem,
  type Block,
  type PageDoc,
} from "@/lib/site-content";

/**
 * The website editor's writes. The console's buttons and the assistant's Do it cards
 * both land here, so every edit is Zod-checked, tenant-scoped and audited the same way.
 *
 * Edits only ever change the DRAFT. The live site changes when, and only when, someone
 * presses Publish (rule 4's spirit: the assistant proposes, a person publishes).
 */

/* ---------------------------------------------------------------- helpers */

function zodMessage(e: z.ZodError): string {
  return e.issues
    .slice(0, 3)
    .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
    .join("; ");
}

async function working(ctx: ActionContext, path: string) {
  const rows = await ctx.tx
    .select({ id: siteContent.id, status: siteContent.status, doc: siteContent.doc, version: siteContent.version })
    .from(siteContent)
    .where(eq(siteContent.path, path));
  const draft = rows.find((r) => r.status === "draft") ?? null;
  const published = rows.find((r) => r.status === "published") ?? null;
  const maxVersion = rows.reduce((m, r) => Math.max(m, r.version), 0);
  return { draft, published, maxVersion };
}

async function saveDraft(ctx: ActionContext, path: string, doc: unknown, note: string) {
  const w = await working(ctx, path);
  if (w.draft) {
    await ctx.tx
      .update(siteContent)
      .set({ doc: doc as Record<string, unknown>, note, createdBy: ctx.userName, createdAt: new Date() })
      .where(eq(siteContent.id, w.draft.id));
  } else {
    await ctx.tx.insert(siteContent).values({
      tenantId: ctx.tenantId,
      path,
      version: w.maxVersion + 1,
      status: "draft",
      doc: doc as Record<string, unknown>,
      note,
      createdBy: ctx.userName,
    });
  }
  await ctx.audit({ kind: "edit", action: "Edited website draft", target: `${path}: ${note}` });
}

async function currentPage(ctx: ActionContext, path: string): Promise<PageDoc> {
  const w = await working(ctx, path);
  const raw = (w.draft ?? w.published)?.doc;
  if (!raw) return { blocks: [] };
  const p = PageDocSchema.safeParse(raw);
  return p.success ? p.data : { blocks: [] };
}

function parseBlock(raw: unknown, builtin: boolean): Block {
  const withId =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? { id: newBlockId(), ...(raw as Record<string, unknown>) }
      : raw;
  const p = BlockSchema.safeParse(withId);
  if (!p.success) throw new ActionError(`That block is not valid: ${zodMessage(p.error)}`);
  if (builtin && p.data.type === "hero") {
    throw new ActionError("Built-in pages already have a hero. Change its text instead.");
  }
  return p.data;
}

function guardPath(path: string) {
  if (LOCKED_PATHS.includes(path)) {
    throw new ActionError(
      "Privacy, terms and complaints are legal text and are not edited here. Change them in the code with a person reviewing the wording.",
    );
  }
  if (path === THEME_PATH) throw new ActionError("Use the theme settings for styling.");
}

function finish(doc: PageDoc): PageDoc {
  const p = PageDocSchema.safeParse(doc);
  if (!p.success) throw new ActionError(`The page would not be valid: ${zodMessage(p.error)}`);
  return p.data;
}

const pathField = z.string().trim().min(1).max(80);

/* ---------------------------------------------------------------- pages */

export const createSitePage = defineAction({
  input: z.object({
    path: pathField,
    title: z.string().trim().max(70).optional(),
    description: z.string().trim().max(170).optional(),
    blocks: z.array(z.unknown()).min(1).max(40),
  }),
  async handler(input, ctx) {
    const problem = newPagePathProblem(input.path);
    if (problem) throw new ActionError(problem);
    const existing = await currentPage(ctx, input.path);
    if (existing.blocks.length && !existing.deleted) {
      throw new ActionError(`${input.path} already exists. Edit it instead.`);
    }
    const blocks = input.blocks.map((b) => parseBlock(b, false));
    const doc = finish({
      meta: input.title || input.description ? { title: input.title, description: input.description } : undefined,
      blocks,
    });
    await saveDraft(ctx, input.path, doc, `Created page with ${blocks.length} blocks`);
    revalidatePath("/website");
    return { path: input.path };
  },
});

export const deleteSitePage = defineAction({
  input: z.object({ path: pathField }),
  async handler(input, ctx) {
    guardPath(input.path);
    if (isBuiltinPath(input.path)) throw new ActionError("Built-in pages cannot be deleted.");
    const doc = await currentPage(ctx, input.path);
    await saveDraft(ctx, input.path, finish({ ...doc, deleted: true }), "Took the page down");
    revalidatePath("/website");
    return { path: input.path };
  },
});

/* --------------------------------------------------------------- blocks */

export const addSiteBlock = defineAction({
  input: z.object({
    path: pathField,
    block: z.unknown(),
    zone: z.enum(["after_hero", "end"]).optional(),
    /** 0-based position among the page's blocks; omitted adds at the end. */
    position: z.number().int().min(0).max(40).optional(),
  }),
  async handler(input, ctx) {
    guardPath(input.path);
    const builtin = isBuiltinPath(input.path);
    const doc = await currentPage(ctx, input.path);
    if (!builtin && (!doc.blocks.length || doc.deleted)) {
      throw new ActionError(`There is no page at ${input.path}. Create it first.`);
    }
    const block = parseBlock(input.block, builtin);
    if (builtin) block.zone = input.zone ?? block.zone ?? "end";
    else delete block.zone;
    const blocks = [...doc.blocks];
    blocks.splice(input.position ?? blocks.length, 0, block);
    await saveDraft(ctx, input.path, finish({ ...doc, blocks }), `Added a ${block.type} block`);
    revalidatePath("/website");
    return { path: input.path, blockId: block.id };
  },
});

export const updateSiteBlock = defineAction({
  input: z.object({ path: pathField, blockId: z.string().max(40), block: z.unknown() }),
  async handler(input, ctx) {
    guardPath(input.path);
    const builtin = isBuiltinPath(input.path);
    const doc = await currentPage(ctx, input.path);
    const i = doc.blocks.findIndex((b) => b.id === input.blockId);
    if (i < 0) throw new ActionError("That block is not on the page any more.");
    const old = doc.blocks[i];
    const raw = { ...(input.block as Record<string, unknown>), id: old.id, zone: old.zone };
    const block = parseBlock(raw, builtin && old.type !== "hero");
    const blocks = [...doc.blocks];
    blocks[i] = block;
    await saveDraft(ctx, input.path, finish({ ...doc, blocks }), `Changed a ${block.type} block`);
    revalidatePath("/website");
    return { path: input.path };
  },
});

export const removeSiteBlock = defineAction({
  input: z.object({ path: pathField, blockId: z.string().max(40) }),
  async handler(input, ctx) {
    guardPath(input.path);
    const doc = await currentPage(ctx, input.path);
    const blocks = doc.blocks.filter((b) => b.id !== input.blockId);
    if (blocks.length === doc.blocks.length) throw new ActionError("That block is not on the page.");
    if (!isBuiltinPath(input.path) && blocks.length === 0) {
      throw new ActionError("A page needs at least one block. Delete the page instead.");
    }
    await saveDraft(ctx, input.path, finish({ ...doc, blocks }), "Removed a block");
    revalidatePath("/website");
    return { path: input.path };
  },
});

/* ----------------------------------------------------------------- text */

export const setSiteText = defineAction({
  input: z.object({
    path: pathField,
    hero: z.unknown().optional(),
    service: z.unknown().optional(),
    title: z.string().trim().max(70).optional(),
    description: z.string().trim().max(170).optional(),
    /** Put the page's own words back for these parts. */
    reset: z.array(z.enum(["hero", "service", "meta"])).optional(),
  }),
  async handler(input, ctx) {
    guardPath(input.path);
    const builtin = isBuiltinPath(input.path);
    const doc = await currentPage(ctx, input.path);
    const next: PageDoc = { ...doc };

    for (const r of input.reset ?? []) delete next[r];

    if (input.hero !== undefined) {
      if (!builtin) throw new ActionError("On a new page, change the hero block instead.");
      const h = HeroTextSchema.safeParse(input.hero);
      if (!h.success) throw new ActionError(`Hero text: ${zodMessage(h.error)}`);
      next.hero = { ...(doc.hero ?? {}), ...h.data };
    }
    if (input.service !== undefined) {
      if (!servicePageBySlug(input.path.slice(1))) {
        throw new ActionError("Points and sections can only be changed on the service pages.");
      }
      const sv = ServiceTextSchema.safeParse(input.service);
      if (!sv.success) throw new ActionError(`Service text: ${zodMessage(sv.error)}`);
      next.service = { ...(doc.service ?? {}), ...sv.data };
    }
    if (input.title !== undefined || input.description !== undefined) {
      if (builtin) {
        throw new ActionError("The search title and description of built-in pages are set in code.");
      }
      next.meta = {
        ...(doc.meta ?? {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      };
    }
    await saveDraft(ctx, input.path, finish(next), "Changed page text");
    revalidatePath("/website");
    return { path: input.path };
  },
});

/* ---------------------------------------------------------------- theme */

export const setSiteTheme = defineAction({
  input: ThemeDocSchema.extend({ reset: z.boolean().optional() }),
  async handler(input, ctx) {
    const { reset, ...patch } = input;
    const w = await working(ctx, THEME_PATH);
    const base = reset ? {} : ((w.draft ?? w.published)?.doc ?? {});
    const merged = ThemeDocSchema.safeParse({ ...base, ...patch });
    if (!merged.success) throw new ActionError(`Theme: ${zodMessage(merged.error)}`);
    await saveDraft(ctx, THEME_PATH, merged.data, reset ? "Reset the theme" : "Changed the theme");
    revalidatePath("/website");
    return { changed: Object.keys(patch).length };
  },
});

/* ------------------------------------------------------------- publishing */

export const publishSitePath = defineAction({
  input: z.object({ path: pathField }),
  async handler(input, ctx) {
    const w = await working(ctx, input.path);
    if (!w.draft) throw new ActionError("There are no unpublished changes on that page.");
    if (w.published) {
      await ctx.tx.update(siteContent).set({ status: "archived" }).where(eq(siteContent.id, w.published.id));
    }
    await ctx.tx
      .update(siteContent)
      .set({ status: "published", publishedAt: new Date() })
      .where(eq(siteContent.id, w.draft.id));
    await ctx.audit({
      kind: "publish",
      action: "Published website changes",
      target: input.path === THEME_PATH ? "Theme" : input.path,
    });
    revalidatePath("/website");
    return { path: input.path };
  },
});

export const discardSiteDraft = defineAction({
  input: z.object({ path: pathField }),
  async handler(input, ctx) {
    const res = await ctx.tx
      .delete(siteContent)
      .where(and(eq(siteContent.path, input.path), eq(siteContent.status, "draft")))
      .returning({ id: siteContent.id });
    if (!res.length) throw new ActionError("There is no draft to discard.");
    await ctx.audit({ kind: "edit", action: "Discarded website draft", target: input.path });
    revalidatePath("/website");
    return { path: input.path };
  },
});

/** Copies an earlier version into the draft. Publish it to make it live again. */
export const restoreSiteVersion = defineAction({
  input: z.object({ id: z.string().uuid() }),
  async handler(input, ctx) {
    const [row] = await ctx.tx
      .select({ path: siteContent.path, doc: siteContent.doc, version: siteContent.version })
      .from(siteContent)
      .where(eq(siteContent.id, input.id));
    if (!row) throw new ActionError("That version no longer exists.");
    guardPath(row.path === THEME_PATH ? "" : row.path);
    await saveDraft(ctx, row.path, row.doc, `Restored version ${row.version}`);
    revalidatePath("/website");
    return { path: row.path };
  },
});

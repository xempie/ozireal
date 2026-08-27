"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { defineAction, ActionError } from "./action";
import { blogPosts, socialPosts, listings } from "@/db/schema";

/**
 * Content drafts — an article, or a social post.
 *
 * Both are created as drafts and can only ever be created as drafts. §7 puts every
 * outward-facing piece through the approval queue, and the difference between
 * "draft" and "published" here is the difference between the agency's name being
 * on something a person read and one they didn't.
 */

/** "Selling in Norwood this spring" -> "selling-in-norwood-this-spring" */
function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

export const createBlogPost = defineAction({
  input: z.object({
    title: z.string().trim().min(4, "Give the article a title").max(200),
    body: z.string().trim().max(60_000).optional(),
  }),
  async handler(input, ctx) {
    const base = slugify(input.title);
    if (!base) {
      throw new ActionError(
        "That title has no letters or numbers in it, so it cannot become a web address.",
      );
    }

    /**
     * Slugs are unique per tenant and never reused. A collision takes a numeric
     * suffix rather than overwriting: the old address must keep pointing at the
     * article it was shared as, which is the whole reason the redirect map exists.
     */
    let slug = base;
    for (let n = 2; n < 100; n++) {
      const [clash] = await ctx.tx
        .select({ id: blogPosts.id })
        .from(blogPosts)
        .where(and(eq(blogPosts.tenantId, ctx.tenantId), eq(blogPosts.slug, slug)))
        .limit(1);
      if (!clash) break;
      slug = `${base}-${n}`;
    }

    // Counted from the body rather than stored as typed, so it cannot disagree with it.
    const wordCount = input.body ? input.body.trim().split(/\s+/).filter(Boolean).length : 0;

    const [created] = await ctx.tx
      .insert(blogPosts)
      .values({
        tenantId: ctx.tenantId,
        slug,
        title: input.title,
        body: input.body || null,
        status: "draft",
        wordCount,
        // publishedAt stays null: it records when something actually went out,
        // and a draft has not.
      })
      .returning({ id: blogPosts.id });

    await ctx.audit({
      kind: "edit",
      action: "Drafted an article",
      target: input.title,
      entityType: "blog_post",
      entityId: created.id,
    });

    revalidatePath("/content");
    return { id: created.id, slug };
  },
});

export const createSocialPost = defineAction({
  input: z.object({
    network: z.enum(["instagram", "facebook", "linkedin"]),
    body: z.string().trim().min(1, "Write the post").max(3000),
    listingId: z.union([z.string().uuid(), z.literal("")]).optional(),
  }),
  async handler(input, ctx) {
    const listingId = input.listingId || null;
    if (listingId) {
      const [l] = await ctx.tx
        .select({ id: listings.id })
        .from(listings)
        .where(eq(listings.id, listingId))
        .limit(1);
      if (!l) throw new ActionError("That listing no longer exists.");
    }

    const [created] = await ctx.tx
      .insert(socialPosts)
      .values({
        tenantId: ctx.tenantId,
        network: input.network,
        status: "draft",
        body: input.body,
        listingId,
      })
      .returning({ id: socialPosts.id });

    await ctx.audit({
      kind: "edit",
      action: `Drafted a ${input.network} post`,
      target: input.body.slice(0, 60),
      entityType: "social_post",
      entityId: created.id,
    });

    revalidatePath("/content");
    return { id: created.id };
  },
});

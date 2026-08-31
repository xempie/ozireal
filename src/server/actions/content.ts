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

/* -------------------------------------------------- editing and removing */

/**
 * Editing an article.
 *
 * The slug is never recomputed from a changed title. §16: slugs are stable and
 * never reused, and an article that has been shared or indexed under one address
 * must keep resolving there — retitling "Selling in spring" is a copy decision, not
 * a decision to break every inbound link to it.
 */
export const updateBlogPost = defineAction({
  input: z.object({
    id: z.string().uuid(),
    title: z.string().trim().min(4, "Give the article a title").max(200),
    body: z.string().trim().max(60_000).optional(),
  }),
  async handler(input, ctx) {
    const [p] = await ctx.tx
      .select({ status: blogPosts.status, slug: blogPosts.slug })
      .from(blogPosts)
      .where(eq(blogPosts.id, input.id))
      .limit(1);
    if (!p) throw new ActionError("That article no longer exists.");
    if (p.status === "in_approval") {
      throw new ActionError(
        "That article is waiting in the approval queue. Edit it there, so the version that was approved is the version that goes out.",
      );
    }

    // Counted from the body rather than stored as typed, so it cannot disagree with it.
    const wordCount = input.body
      ? input.body.trim().split(/\s+/).filter(Boolean).length
      : 0;

    await ctx.tx
      .update(blogPosts)
      .set({ title: input.title, body: input.body || null, wordCount })
      .where(eq(blogPosts.id, input.id));

    await ctx.audit({
      kind: "edit",
      action: "Edited an article",
      target: input.title,
      entityType: "blog_post",
      entityId: input.id,
    });

    revalidatePath("/content");
    return { id: input.id, slug: p.slug };
  },
});

/**
 * Moving an article through its lifecycle.
 *
 * "published" is not a choice here, and that is rule 1 rather than an oversight:
 * an article goes out under the agency's name, so it reaches the public through the
 * approval queue and nowhere else. What this offers is send-it-for-approval, pull-it-
 * back-to-draft, and archive.
 */
export const setBlogPostStatus = defineAction({
  input: z.object({
    id: z.string().uuid(),
    status: z.enum(["draft", "in_approval", "archived"]),
  }),
  async handler(input, ctx) {
    const [p] = await ctx.tx
      .select({
        title: blogPosts.title,
        status: blogPosts.status,
        body: blogPosts.body,
      })
      .from(blogPosts)
      .where(eq(blogPosts.id, input.id))
      .limit(1);
    if (!p) throw new ActionError("That article no longer exists.");
    if (p.status === input.status) {
      throw new ActionError("That article is already in that state.");
    }
    if (p.status === "published" && input.status !== "archived") {
      throw new ActionError(
        "That article is published. It can be archived, but it cannot go back to being a draft — the address has to keep resolving to what people were shown.",
      );
    }
    if (input.status === "in_approval" && !p.body?.trim()) {
      throw new ActionError("There is nothing to approve — the article has no body yet.");
    }

    await ctx.tx
      .update(blogPosts)
      .set({ status: input.status })
      .where(eq(blogPosts.id, input.id));

    await ctx.audit({
      kind: "edit",
      action:
        input.status === "in_approval"
          ? "Sent an article to the approval queue"
          : `Article moved to ${input.status}`,
      target: p.title,
      entityType: "blog_post",
      entityId: input.id,
      metadata: { from: p.status, to: input.status },
    });

    revalidatePath("/content");
    revalidatePath("/approvals");
    return { status: input.status };
  },
});

/**
 * Deleting an article — never a published one.
 *
 * A published address has to keep resolving; deleting the row is how a live URL
 * becomes a 404 with nothing recording that it ever existed. Archive covers the
 * "take it down" case and keeps the slug reserved, so it can never be handed to a
 * different article later.
 */
export const deleteBlogPost = defineAction({
  input: z.object({ id: z.string().uuid() }),
  async handler(input, ctx) {
    const [p] = await ctx.tx
      .select({ title: blogPosts.title, status: blogPosts.status })
      .from(blogPosts)
      .where(eq(blogPosts.id, input.id))
      .limit(1);
    if (!p) throw new ActionError("That article no longer exists.");
    if (p.status === "published") {
      throw new ActionError(
        "That article is published. Archive it instead — deleting the row would turn a live address into a 404 and free the slug for something else.",
      );
    }

    await ctx.audit({
      kind: "edit",
      action: "Deleted an article draft",
      target: p.title,
      entityType: "blog_post",
      entityId: input.id,
    });

    await ctx.tx.delete(blogPosts).where(eq(blogPosts.id, input.id));

    revalidatePath("/content");
    return { deleted: true };
  },
});

/* ------------------------------------------------------------ social */

export const updateSocialPost = defineAction({
  input: z.object({
    id: z.string().uuid(),
    network: z.enum(["instagram", "facebook", "linkedin"]),
    body: z.string().trim().min(1, "Write the post").max(3000),
    listingId: z.union([z.string().uuid(), z.literal("")]).optional(),
  }),
  async handler(input, ctx) {
    const [s] = await ctx.tx
      .select({ status: socialPosts.status })
      .from(socialPosts)
      .where(eq(socialPosts.id, input.id))
      .limit(1);
    if (!s) throw new ActionError("That post no longer exists.");
    if (s.status === "published") {
      throw new ActionError(
        "That post is already out. Editing our copy of it would leave this record disagreeing with what people actually saw.",
      );
    }
    if (s.status === "in_approval") {
      throw new ActionError(
        "That post is waiting in the approval queue. Edit it there, so the version that was approved is the version that goes out.",
      );
    }

    const listingId = input.listingId || null;
    if (listingId) {
      const [l] = await ctx.tx
        .select({ id: listings.id })
        .from(listings)
        .where(eq(listings.id, listingId))
        .limit(1);
      if (!l) throw new ActionError("That listing no longer exists.");
    }

    await ctx.tx
      .update(socialPosts)
      .set({ network: input.network, body: input.body, listingId })
      .where(eq(socialPosts.id, input.id));

    await ctx.audit({
      kind: "edit",
      action: `Edited a ${input.network} post`,
      target: input.body.slice(0, 60),
      entityType: "social_post",
      entityId: input.id,
    });

    revalidatePath("/content");
    return { id: input.id };
  },
});

/** Same shape and the same reasoning as the article lifecycle: no direct publish. */
export const setSocialPostStatus = defineAction({
  input: z.object({
    id: z.string().uuid(),
    status: z.enum(["draft", "in_approval", "archived"]),
  }),
  async handler(input, ctx) {
    const [s] = await ctx.tx
      .select({ body: socialPosts.body, status: socialPosts.status })
      .from(socialPosts)
      .where(eq(socialPosts.id, input.id))
      .limit(1);
    if (!s) throw new ActionError("That post no longer exists.");
    if (s.status === input.status) {
      throw new ActionError("That post is already in that state.");
    }
    if (s.status === "published" && input.status !== "archived") {
      throw new ActionError(
        "That post is published. It can be archived, but it cannot go back to being a draft.",
      );
    }

    await ctx.tx
      .update(socialPosts)
      .set({ status: input.status })
      .where(eq(socialPosts.id, input.id));

    await ctx.audit({
      kind: "edit",
      action:
        input.status === "in_approval"
          ? "Sent a social post to the approval queue"
          : `Social post moved to ${input.status}`,
      target: s.body.slice(0, 60),
      entityType: "social_post",
      entityId: input.id,
      metadata: { from: s.status, to: input.status },
    });

    revalidatePath("/content");
    revalidatePath("/approvals");
    return { status: input.status };
  },
});

export const deleteSocialPost = defineAction({
  input: z.object({ id: z.string().uuid() }),
  async handler(input, ctx) {
    const [s] = await ctx.tx
      .select({ body: socialPosts.body, status: socialPosts.status })
      .from(socialPosts)
      .where(eq(socialPosts.id, input.id))
      .limit(1);
    if (!s) throw new ActionError("That post no longer exists.");
    if (s.status === "published") {
      throw new ActionError(
        "That post went out under the agency's name. Archive it instead — the record of what was published is not ours to erase.",
      );
    }

    await ctx.audit({
      kind: "edit",
      action: "Deleted a social draft",
      target: s.body.slice(0, 60),
      entityType: "social_post",
      entityId: input.id,
    });

    await ctx.tx.delete(socialPosts).where(eq(socialPosts.id, input.id));

    revalidatePath("/content");
    return { deleted: true };
  },
});

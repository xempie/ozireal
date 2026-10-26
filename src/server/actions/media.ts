"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { asc, eq } from "drizzle-orm";
import { defineAction, ActionError, type ActionContext } from "./action";
import { listingMedia } from "@/db/schema";
import { deleteMedia } from "@/server/media/s3";

/**
 * Arranging a listing's photos. The first photo (lowest sort order) is the main photo:
 * it is the one on the home page, the listing cards and the search results.
 */

async function photosOf(ctx: ActionContext, mediaId: string) {
  const [m] = await ctx.tx
    .select({ id: listingMedia.id, listingId: listingMedia.listingId, s3Key: listingMedia.s3Key })
    .from(listingMedia)
    .where(eq(listingMedia.id, mediaId));
  if (!m) throw new ActionError("That photo is no longer there.");
  const all = await ctx.tx
    .select({ id: listingMedia.id })
    .from(listingMedia)
    .where(eq(listingMedia.listingId, m.listingId))
    .orderBy(asc(listingMedia.sortOrder), asc(listingMedia.createdAt));
  return { m, ids: all.map((r) => r.id) };
}

async function writeOrder(ctx: ActionContext, ids: string[]) {
  for (let i = 0; i < ids.length; i++) {
    await ctx.tx.update(listingMedia).set({ sortOrder: i }).where(eq(listingMedia.id, ids[i]));
  }
}

const id = z.object({ id: z.string().uuid() });

export const setMainListingPhoto = defineAction({
  input: id,
  async handler(input, ctx) {
    const { m, ids } = await photosOf(ctx, input.id);
    await writeOrder(ctx, [input.id, ...ids.filter((x) => x !== input.id)]);
    await ctx.audit({ kind: "edit", action: "Set the main listing photo", target: m.listingId, entityType: "listing", entityId: m.listingId });
    revalidatePath(`/listings/${m.listingId}`);
    return { listingId: m.listingId };
  },
});

export const moveListingPhoto = defineAction({
  input: z.object({ id: z.string().uuid(), direction: z.enum(["earlier", "later"]) }),
  async handler(input, ctx) {
    const { m, ids } = await photosOf(ctx, input.id);
    const i = ids.indexOf(input.id);
    const j = input.direction === "earlier" ? i - 1 : i + 1;
    if (j < 0 || j >= ids.length) return { listingId: m.listingId };
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await writeOrder(ctx, ids);
    revalidatePath(`/listings/${m.listingId}`);
    return { listingId: m.listingId };
  },
});

export const updateListingPhoto = defineAction({
  input: z.object({
    id: z.string().uuid(),
    altText: z.string().trim().max(200).optional(),
    kind: z.enum(["photo", "floorplan"]).optional(),
  }),
  async handler(input, ctx) {
    const { m } = await photosOf(ctx, input.id);
    await ctx.tx
      .update(listingMedia)
      .set({
        ...(input.altText !== undefined ? { altText: input.altText || null } : {}),
        ...(input.kind ? { kind: input.kind } : {}),
      })
      .where(eq(listingMedia.id, input.id));
    revalidatePath(`/listings/${m.listingId}`);
    return { listingId: m.listingId };
  },
});

export const deleteListingPhoto = defineAction({
  input: id,
  async handler(input, ctx) {
    const { m, ids } = await photosOf(ctx, input.id);
    await ctx.tx.delete(listingMedia).where(eq(listingMedia.id, input.id));
    await writeOrder(ctx, ids.filter((x) => x !== input.id));
    // The file goes only once the row is gone for good.
    ctx.afterCommit(() => deleteMedia(m.s3Key));
    await ctx.audit({ kind: "edit", action: "Deleted a listing photo", target: m.listingId, entityType: "listing", entityId: m.listingId });
    revalidatePath(`/listings/${m.listingId}`);
    return { listingId: m.listingId };
  },
});

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { buildingChecks } from "@/db/schema";
import { defineAction, ActionError } from "./action";
import { enqueue } from "@/server/jobs/queues";
import { deleteMedia } from "@/server/media/s3";

/** Run a check again over the same photos (after a failure, or a prompt update). */
export const rerunBuildingCheck = defineAction({
  input: z.object({ id: z.string().uuid() }),
  async handler(input, ctx) {
    const [c] = await ctx.tx
      .select({ status: buildingChecks.status })
      .from(buildingChecks)
      .where(eq(buildingChecks.id, input.id))
      .limit(1);
    if (!c) throw new ActionError("That check no longer exists.");
    if (c.status === "queued" || c.status === "running") throw new ActionError("It is already running.");
    await ctx.tx.update(buildingChecks).set({ status: "queued", error: null }).where(eq(buildingChecks.id, input.id));
    await ctx.audit({ kind: "edit", action: "Re-ran a building check", target: input.id, entityType: "building_check", entityId: input.id });
    ctx.afterCommit(() => enqueue("RunBuildingCheck", { tenantId: ctx.tenantId, entityId: input.id }));
    revalidatePath(`/building-checks/${input.id}`);
    return { id: input.id };
  },
});

/** Delete a check and its private photos. */
export const deleteBuildingCheck = defineAction({
  input: z.object({ id: z.string().uuid() }),
  async handler(input, ctx) {
    const [c] = await ctx.tx
      .delete(buildingChecks)
      .where(eq(buildingChecks.id, input.id))
      .returning({ photos: buildingChecks.photos, propertyId: buildingChecks.propertyId });
    if (!c) throw new ActionError("That check no longer exists.");
    await ctx.audit({ kind: "edit", action: "Deleted a building check", target: input.id, entityType: "building_check", entityId: input.id });
    // The photos go once the row is gone for good.
    ctx.afterCommit(async () => {
      await Promise.allSettled(c.photos.map((p) => deleteMedia(p.key)));
    });
    revalidatePath("/building-checks");
    if (c.propertyId) revalidatePath(`/properties/${c.propertyId}`);
    return { deleted: true };
  },
});

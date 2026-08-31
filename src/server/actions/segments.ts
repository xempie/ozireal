"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { defineAction, ActionError } from "./action";
import { savedViews } from "@/db/schema";
import { segmentFilter, describeSegment, isEmptySegment } from "@/server/segments/schema";
import { previewSegmentIn, type SegmentPreview } from "@/server/segments/preview";

/**
 * Segments: previewing an audience, and saving one to use again.
 *
 * `previewAudience` is a read that goes through `defineAction` anyway, for two
 * reasons that both matter: it still refuses without a session, and it still runs
 * inside a `withTenant` transaction so row-level security applies. What it does NOT
 * do is call `ctx.audit` — the panel re-runs as the agent moves a slider, and an
 * audit row per keystroke would bury the events that matter in the ones that do not.
 * Audit records decisions; this is a question.
 */

export const previewAudience = defineAction({
  input: z.object({ filter: segmentFilter }),
  async handler(input, ctx): Promise<SegmentPreview & { description: string }> {
    const preview = await previewSegmentIn(ctx.tx, input.filter);
    return { ...preview, description: describeSegment(input.filter) };
  },
});

/**
 * Saving a segment.
 *
 * Writes `saved_views.filter`, a jsonb column that has existed since B0 and never had
 * a reader — the seed put a placeholder `{note: "..."}` in it and the contacts screen
 * rendered the rows as dashed, unclickable chips with the note "Filtering is not
 * built yet". This is what makes them real.
 */
export const saveSegment = defineAction({
  input: z.object({
    name: z.string().trim().min(2, "Give the segment a name").max(80),
    description: z.string().trim().max(300).optional(),
    filter: segmentFilter,
    /** Set when overwriting an existing view rather than creating one. */
    id: z.union([z.string().uuid(), z.literal("")]).optional(),
  }),
  async handler(input, ctx) {
    /**
     * An empty segment is "everyone contactable" — a legitimate thing to send to, but
     * almost never a thing worth SAVING under a name. Saving it produces a view whose
     * name promises a narrowing it does not perform, which is worse than no view.
     */
    if (isEmptySegment(input.filter)) {
      throw new ActionError(
        "That segment has no criteria, so it would match everyone. Narrow it before saving it under a name.",
      );
    }

    const id = input.id || null;
    const description = input.description || describeSegment(input.filter);

    const [clash] = await ctx.tx
      .select({ id: savedViews.id })
      .from(savedViews)
      .where(
        id
          ? and(eq(savedViews.name, input.name), ne(savedViews.id, id))
          : eq(savedViews.name, input.name),
      )
      .limit(1);
    if (clash) {
      throw new ActionError(
        `There is already a segment called "${input.name}". Rename this one, or open that one and save over it.`,
      );
    }

    if (id) {
      const [existing] = await ctx.tx
        .select({ id: savedViews.id })
        .from(savedViews)
        .where(eq(savedViews.id, id))
        .limit(1);
      if (!existing) throw new ActionError("That segment no longer exists.");

      await ctx.tx
        .update(savedViews)
        .set({ name: input.name, description, filter: input.filter })
        .where(eq(savedViews.id, id));

      await ctx.audit({
        kind: "edit",
        action: "Updated a saved segment",
        target: input.name,
        entityType: "saved_view",
        entityId: id,
        metadata: { filter: input.filter },
      });

      revalidatePath("/campaigns");
      revalidatePath("/contacts");
      return { id };
    }

    const [created] = await ctx.tx
      .insert(savedViews)
      .values({
        tenantId: ctx.tenantId,
        name: input.name,
        description,
        filter: input.filter,
        createdByUserId: ctx.userId,
      })
      .returning({ id: savedViews.id });

    await ctx.audit({
      kind: "edit",
      action: "Saved a segment",
      target: input.name,
      entityType: "saved_view",
      entityId: created.id,
      // The filter itself, so the audit trail can answer "what did this view ask
      // for on the day it was used" even after someone edits it later.
      metadata: { filter: input.filter },
    });

    revalidatePath("/campaigns");
    revalidatePath("/contacts");
    return { id: created.id };
  },
});

export const deleteSegment = defineAction({
  input: z.object({ id: z.string().uuid() }),
  async handler(input, ctx) {
    const [v] = await ctx.tx
      .select({ name: savedViews.name })
      .from(savedViews)
      .where(eq(savedViews.id, input.id))
      .limit(1);
    if (!v) throw new ActionError("That segment no longer exists.");

    await ctx.audit({
      kind: "edit",
      action: "Deleted a saved segment",
      target: v.name,
      entityType: "saved_view",
      entityId: input.id,
    });

    /**
     * Campaigns keep their own copy of the filter and reference this row with ON
     * DELETE SET NULL (migration 0013), so deleting a view can never destroy the
     * record of who a past campaign was sent to.
     */
    await ctx.tx.delete(savedViews).where(eq(savedViews.id, input.id));

    revalidatePath("/campaigns");
    revalidatePath("/contacts");
    return { deleted: true };
  },
});

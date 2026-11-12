"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, inArray, notInArray } from "drizzle-orm";
import { defineAction, ActionError } from "./action";
import { inspections, listingMedia, listings, matches, properties } from "@/db/schema";
import { changeListingStatus, revalidatePublicListings } from "@/server/stock/write";
import { enqueue } from "@/server/jobs/queues";
import { MATCHABLE_PROPERTY_STATUSES } from "@/server/matching/engine";

/**
 * Bulk actions on the property list (owner's request, 2026-11-12), the same shape as
 * the contacts bar: tick, choose, confirm. Each goes through the same rules as the
 * single-property screens; anything that cannot be done is skipped and named.
 */

const ids = z.array(z.string().uuid()).min(1, "Select at least one property").max(500);

export const bulkSetPropertyStatus = defineAction({
  input: z.object({
    propertyIds: ids,
    status: z.enum(["prospect", "appraised", "off_market", "sold", "archived"]),
  }),
  async handler(input, ctx) {
    const rows = await ctx.tx
      .update(properties)
      .set({ status: input.status })
      .where(inArray(properties.id, input.propertyIds))
      .returning({ id: properties.id });
    await ctx.audit({
      kind: "edit",
      action: `Set ${rows.length} properties to ${input.status.replace("_", " ")}`,
      target: `${rows.length} properties`,
      entityType: "property",
      entityId: rows[0]?.id ?? input.propertyIds[0],
    });
    if ((MATCHABLE_PROPERTY_STATUSES as readonly string[]).includes(input.status)) {
      ctx.afterCommit(async () => {
        for (const r of rows) await enqueue("MatchProperty", { tenantId: ctx.tenantId, entityId: r.id });
      });
    }
    revalidatePath("/properties");
    revalidatePath("/matching");
    return { count: rows.length };
  },
});

/** Put each property's current listing on the website, or take it off. */
export const bulkWebsite = defineAction({
  input: z.object({ propertyIds: ids, to: z.enum(["live", "withdrawn"]) }),
  async handler(input, ctx) {
    const from = input.to === "live" ? ["draft", "withdrawn"] : ["live", "under_offer"];
    const ls = await ctx.tx
      .select({ id: listings.id, propertyId: listings.propertyId, status: listings.status, createdAt: listings.createdAt })
      .from(listings)
      .where(and(inArray(listings.propertyId, input.propertyIds), inArray(listings.status, from as ("draft" | "withdrawn" | "live" | "under_offer")[])));
    // One listing per property: the newest that can move.
    const pick = new Map<string, (typeof ls)[number]>();
    for (const l of ls) {
      const cur = pick.get(l.propertyId);
      if (!cur || l.createdAt > cur.createdAt) pick.set(l.propertyId, l);
    }
    let done = 0;
    const skipped: string[] = [];
    for (const pid of input.propertyIds) {
      const l = pick.get(pid);
      if (!l) {
        skipped.push(input.to === "live" ? "no draft listing to publish" : "not on the website");
        continue;
      }
      try {
        await changeListingStatus({ id: l.id, status: input.to }, ctx);
        done++;
      } catch (e) {
        if (e instanceof ActionError) skipped.push(e.message);
        else throw e;
      }
    }
    if (done) revalidatePublicListings();
    revalidatePath("/properties");
    const reasons = [...new Set(skipped)];
    return { count: done, skipped: skipped.length, reasons };
  },
});

export const bulkRematch = defineAction({
  input: z.object({ propertyIds: ids }),
  async handler(input, ctx) {
    const rows = await ctx.tx
      .select({ id: properties.id })
      .from(properties)
      .where(and(inArray(properties.id, input.propertyIds), inArray(properties.status, [...MATCHABLE_PROPERTY_STATUSES])));
    ctx.afterCommit(async () => {
      for (const r of rows) await enqueue("MatchProperty", { tenantId: ctx.tenantId, entityId: r.id });
    });
    return { count: rows.length, skipped: input.propertyIds.length - rows.length };
  },
});

/**
 * Delete properties. One that was ever advertised (a live, under-offer, sold or leased
 * listing) is skipped: its campaign is the website's archive. Draft and withdrawn
 * listings go with the property.
 */
export const bulkDeleteProperties = defineAction({
  input: z.object({ propertyIds: ids }),
  async handler(input, ctx) {
    const advertised = await ctx.tx
      .select({ propertyId: listings.propertyId })
      .from(listings)
      .where(and(inArray(listings.propertyId, input.propertyIds), notInArray(listings.status, ["draft", "withdrawn"])));
    const keep = new Set(advertised.map((a) => a.propertyId));
    const del = input.propertyIds.filter((id) => !keep.has(id));
    if (!del.length) throw new ActionError("All of these have been on the website, so they stay for the sold archive. Archive them instead.");
    const ls = await ctx.tx.select({ id: listings.id }).from(listings).where(inArray(listings.propertyId, del));
    const lids = ls.map((l) => l.id);
    if (lids.length) {
      await ctx.tx.delete(inspections).where(inArray(inspections.listingId, lids));
      await ctx.tx.delete(listingMedia).where(inArray(listingMedia.listingId, lids));
      await ctx.tx.delete(listings).where(inArray(listings.id, lids));
    }
    await ctx.tx.delete(matches).where(inArray(matches.propertyId, del));
    const gone = await ctx.tx.delete(properties).where(inArray(properties.id, del)).returning({ id: properties.id });
    await ctx.audit({
      kind: "edit",
      action: `Deleted ${gone.length} properties`,
      target: `${gone.length} properties`,
      entityType: "property",
      entityId: del[0],
    });
    revalidatePath("/properties");
    revalidatePath("/matching");
    return { count: gone.length, skipped: keep.size };
  },
});

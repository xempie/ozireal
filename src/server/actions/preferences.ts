"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { defineAction, ActionError } from "./action";
import { contacts, contactPreferences, contactPreferenceSuburbs, suburbs } from "@/db/schema";
import { enqueue } from "@/server/jobs/queues";

/**
 * Set what a contact is looking for, directly.
 *
 * Until now preferences could only arrive from AI extraction via the confirm queue, so a
 * contact added by hand or from the chat had none, and the matcher, which joins on the
 * preferences row, reported them as "gone". This is the person's own write: from the
 * contact screen or a confirmed chat card, never from the model alone (§3.5).
 *
 * Only the fields given change. Suburbs ADD by default; `replaceSuburbs` swaps the list.
 * A suburb that matches nothing in the suburb list refuses the whole change, because a
 * silently dropped suburb is a buyer who silently never matches there.
 */

const PROPERTY_TYPES = ["house", "unit", "townhouse", "land", "acreage", "commercial"] as const;
const int = (max: number) => z.number().int().min(0).max(max).optional();

export const setContactPreferences = defineAction({
  input: z.object({
    contactId: z.string().uuid(),
    priceMin: int(50_000_000),
    priceMax: int(50_000_000),
    rentPwMax: int(100_000),
    bedsMin: int(12),
    bathsMin: int(12),
    parkingMin: int(12),
    propertyTypes: z.array(z.enum(PROPERTY_TYPES)).max(6).optional(),
    suburbs: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
    replaceSuburbs: z.boolean().optional(),
    timeline: z.string().trim().max(200).optional(),
    financeStatus: z.string().trim().max(200).optional(),
    softRequirements: z.string().trim().max(1000).optional(),
  }),
  async handler(input, ctx) {
    if (input.priceMin !== undefined && input.priceMax !== undefined && input.priceMin > input.priceMax) {
      throw new ActionError("The minimum price is above the maximum.");
    }

    const [c] = await ctx.tx
      .select({
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        tombstonedAt: contacts.tombstonedAt,
        mergedIntoId: contacts.mergedIntoId,
      })
      .from(contacts)
      .where(eq(contacts.id, input.contactId))
      .limit(1);
    if (!c) throw new ActionError("That contact no longer exists.");
    if (c.mergedIntoId) throw new ActionError("That record was merged. Set preferences on the surviving record.");
    if (c.tombstonedAt) throw new ActionError("That contact asked to be removed.");

    // Resolve suburbs first, so an unknown one refuses before anything is written.
    const suburbIds: string[] = [];
    if (input.suburbs?.length) {
      const unknown: string[] = [];
      for (const name of input.suburbs) {
        const [s] = await ctx.tx
          .select({ id: suburbs.id })
          .from(suburbs)
          .where(sql`lower(${suburbs.name}) = lower(${name})`)
          .limit(1);
        if (s) suburbIds.push(s.id);
        else unknown.push(name);
      }
      if (unknown.length) {
        throw new ActionError(
          `Not in the suburb list: ${unknown.join(", ")}. Check the spelling. Nothing was changed.`,
        );
      }
    }

    let [prefs] = await ctx.tx
      .select({ id: contactPreferences.id })
      .from(contactPreferences)
      .where(eq(contactPreferences.contactId, input.contactId))
      .limit(1);
    if (!prefs) {
      [prefs] = await ctx.tx
        .insert(contactPreferences)
        .values({ tenantId: ctx.tenantId, contactId: input.contactId })
        .returning({ id: contactPreferences.id });
    }

    const set: Record<string, unknown> = {};
    for (const k of [
      "priceMin",
      "priceMax",
      "rentPwMax",
      "bedsMin",
      "bathsMin",
      "parkingMin",
      "propertyTypes",
      "timeline",
      "financeStatus",
      "softRequirements",
    ] as const) {
      if (input[k] !== undefined) set[k] = input[k];
    }
    if (Object.keys(set).length) {
      await ctx.tx.update(contactPreferences).set(set).where(eq(contactPreferences.id, prefs.id));
    }

    if (input.suburbs) {
      if (input.replaceSuburbs) {
        await ctx.tx.delete(contactPreferenceSuburbs).where(eq(contactPreferenceSuburbs.preferenceId, prefs.id));
      }
      for (const id of suburbIds) {
        await ctx.tx
          .insert(contactPreferenceSuburbs)
          .values({ preferenceId: prefs.id, suburbId: id })
          .onConflictDoNothing();
      }
    }

    // The similarity stage reads an embedding of these; refresh it after commit.
    ctx.afterCommit(() =>
      enqueue("EmbedContactPreferences", { tenantId: ctx.tenantId, entityId: input.contactId }),
    );

    await ctx.audit({
      kind: "edit",
      action: "Set what a contact is looking for",
      target: `${c.firstName} ${c.lastName}`,
      entityType: "contact",
      entityId: input.contactId,
      metadata: { fields: [...Object.keys(set), ...(input.suburbs ? ["suburbs"] : [])] },
    });

    revalidatePath(`/contacts/${input.contactId}`);
    return { id: prefs.id };
  },
});

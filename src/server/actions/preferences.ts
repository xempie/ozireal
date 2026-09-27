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
/** Absent = leave as is. null = clear it. A number = set it. */
const int = (max: number) => z.number().int().min(0).max(max).nullable().optional();
const text = (max: number) => z.string().trim().max(max).nullable().optional();

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
    /**
     * Where they are looking, suburbs and postcodes mixed: "Norwood", "5067",
     * "Norwood 5067". See resolveAreas. Added to what is there, unless replaceAreas.
     */
    areas: z.array(z.string().trim().min(1).max(80)).max(40).optional(),
    replaceAreas: z.boolean().optional(),
    timeline: text(200),
    financeStatus: text(200),
    softRequirements: text(1000),
  }),
  async handler(input, ctx) {
    if (input.priceMin != null && input.priceMax != null && input.priceMin > input.priceMax) {
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

    /**
     * Resolve the areas first, so anything unrecognised refuses before a write.
     *
     *   "5067"          a postcode, used as is.
     *   "Norwood"       a suburb from the suburb list (every suburb of that name).
     *   "Norwood 5067"  the suburb if the list has it, otherwise the postcode, so a
     *                   suburb that was never loaded still works.
     *
     * A bare name the list does not know is refused rather than dropped: a silently
     * missing area is a buyer who silently never matches there.
     */
    const suburbIds: string[] = [];
    const postcodes: string[] = [];
    if (input.areas?.length) {
      const unknown: string[] = [];
      for (const raw of input.areas) {
        const t = raw.replace(/\s+/g, " ").trim();
        if (/^\d{4}$/.test(t)) {
          postcodes.push(t);
          continue;
        }
        const m = /^(.+?)[\s,]+(\d{4})$/.exec(t);
        const name = m ? m[1].trim() : t;
        const pc = m ? m[2] : null;
        const found = await ctx.tx
          .select({ id: suburbs.id })
          .from(suburbs)
          .where(
            pc
              ? sql`lower(${suburbs.name}) = lower(${name}) and ${suburbs.postcode} = ${pc}`
              : sql`lower(${suburbs.name}) = lower(${name})`,
          );
        if (found.length) suburbIds.push(...found.map((s) => s.id));
        else if (pc) postcodes.push(pc);
        else unknown.push(name);
      }
      if (unknown.length) {
        throw new ActionError(
          `Not recognised: ${unknown.join(", ")}. Add the postcode (e.g. "${unknown[0]} 5000") or use the postcode on its own. Nothing was changed.`,
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

    if (input.areas) {
      if (input.replaceAreas) {
        await ctx.tx.delete(contactPreferenceSuburbs).where(eq(contactPreferenceSuburbs.preferenceId, prefs.id));
      }
      for (const id of suburbIds) {
        await ctx.tx
          .insert(contactPreferenceSuburbs)
          .values({ preferenceId: prefs.id, suburbId: id })
          .onConflictDoNothing();
      }
      const [current] = await ctx.tx
        .select({ postcodes: contactPreferences.postcodes })
        .from(contactPreferences)
        .where(eq(contactPreferences.id, prefs.id));
      const next = [...new Set([...(input.replaceAreas ? [] : (current?.postcodes ?? [])), ...postcodes])].sort();
      await ctx.tx
        .update(contactPreferences)
        .set({ postcodes: next.length ? next : null })
        .where(eq(contactPreferences.id, prefs.id));
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
      metadata: { fields: [...Object.keys(set), ...(input.areas ? ["areas"] : [])] },
    });

    revalidatePath(`/contacts/${input.contactId}`);
    return { id: prefs.id };
  },
});

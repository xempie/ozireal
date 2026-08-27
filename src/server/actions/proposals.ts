"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { defineAction, ActionError } from "./action";
import { optionalInt } from "./fields";
import { proposals, contacts, properties, suburbs } from "@/db/schema";

/**
 * A listing proposal — the document that carries a price estimate to a prospective
 * vendor.
 *
 * Created as a draft. It goes out under the agency's name with a number on it, so
 * it takes the same approval path as any other outbound message (§7); nothing here
 * generates and sends in one step.
 */
export const createProposal = defineAction({
  input: z.object({
    contactId: z.string().uuid("Choose the vendor this is for"),
    propertyId: z.union([z.string().uuid(), z.literal("")]).optional(),
    estimateLow: optionalInt(0, 200_000_000, "Whole dollars"),
    estimateHigh: optionalInt(0, 200_000_000, "Whole dollars"),
  }),
  async handler(input, ctx) {
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
    if (c.mergedIntoId) {
      throw new ActionError(
        "That record was merged into another one. Build the proposal against the surviving record.",
      );
    }
    if (c.tombstonedAt) {
      throw new ActionError("That contact asked to be removed, so nothing further is sent to them.");
    }

    let target = `${c.firstName} ${c.lastName}`;
    const propertyId = input.propertyId || null;
    if (propertyId) {
      const [p] = await ctx.tx
        .select({ street: properties.street, suburbName: suburbs.name })
        .from(properties)
        .leftJoin(suburbs, eq(suburbs.id, properties.suburbId))
        .where(eq(properties.id, propertyId))
        .limit(1);
      if (!p) throw new ActionError("That property no longer exists.");
      target = `${p.street}${p.suburbName ? `, ${p.suburbName}` : ""} — ${target}`;
    }

    /**
     * A range, never a single number.
     *
     * Half a range is the dangerous shape: an appraisal quoted as one figure is
     * what under-quoting provisions exist to catch, and a low with no high reads
     * as a promise. Either both, or neither.
     */
    const low = input.estimateLow;
    const high = input.estimateHigh;
    if ((low === undefined) !== (high === undefined)) {
      throw new ActionError(
        "An estimate is a range. Give both a low and a high figure, or leave both blank until you have appraised it.",
      );
    }
    if (low !== undefined && high !== undefined && low > high) {
      throw new ActionError("The low estimate is above the high one.");
    }

    const [created] = await ctx.tx
      .insert(proposals)
      .values({
        tenantId: ctx.tenantId,
        propertyId,
        contactId: input.contactId,
        status: "draft",
        estimateLow: low ?? null,
        estimateHigh: high ?? null,
        // comparables, pages and pdf_s3_key are filled by the generation step —
        // claiming "12 comparables" on a document nobody has built yet is a lie
        // the proposals table would then report as fact.
      })
      .returning({ id: proposals.id });

    await ctx.audit({
      kind: "edit",
      action: "Started a proposal",
      target,
      entityType: "proposal",
      entityId: created.id,
    });

    revalidatePath("/proposals");
    return { id: created.id };
  },
});

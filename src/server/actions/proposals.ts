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

/* -------------------------------------------------- editing and removing */

/**
 * Correcting a proposal, with the same range rule as creation.
 *
 * Only while it is a draft. Once it has been sent, the figures on it are what a
 * vendor was told; editing them here would leave the record disagreeing with the
 * document in their inbox, which is precisely the disagreement an under-quoting
 * complaint turns on.
 */
export const updateProposal = defineAction({
  input: z.object({
    id: z.string().uuid(),
    propertyId: z.union([z.string().uuid(), z.literal("")]).optional(),
    estimateLow: optionalInt(0, 200_000_000, "Whole dollars"),
    estimateHigh: optionalInt(0, 200_000_000, "Whole dollars"),
  }),
  async handler(input, ctx) {
    const [p] = await ctx.tx
      .select({
        status: proposals.status,
        contactId: proposals.contactId,
      })
      .from(proposals)
      .where(eq(proposals.id, input.id))
      .limit(1);
    if (!p) throw new ActionError("That proposal no longer exists.");
    if (p.status === "sent" || p.status === "won" || p.status === "lost") {
      throw new ActionError(
        "That proposal has been sent. Its figures are what the vendor was told — start a new one rather than rewriting the record of the old.",
      );
    }
    if (p.status === "in_approval") {
      throw new ActionError(
        "That proposal is waiting in the approval queue. Edit it there, so the figures that were approved are the figures that go out.",
      );
    }

    const propertyId = input.propertyId || null;
    let target = "";
    if (propertyId) {
      const [prop] = await ctx.tx
        .select({ street: properties.street, suburbName: suburbs.name })
        .from(properties)
        .leftJoin(suburbs, eq(suburbs.id, properties.suburbId))
        .where(eq(properties.id, propertyId))
        .limit(1);
      if (!prop) throw new ActionError("That property no longer exists.");
      target = `${prop.street}${prop.suburbName ? `, ${prop.suburbName}` : ""}`;
    }

    /** A range, never a single number — half a range reads as a promise. */
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

    await ctx.tx
      .update(proposals)
      .set({
        propertyId,
        estimateLow: low ?? null,
        estimateHigh: high ?? null,
      })
      .where(eq(proposals.id, input.id));

    await ctx.audit({
      kind: "edit",
      action: "Updated a proposal",
      target: target || "proposal",
      entityType: "proposal",
      entityId: input.id,
    });

    revalidatePath("/proposals");
    return { id: input.id };
  },
});

/**
 * Sending a proposal for approval — the only route out of draft.
 *
 * Rule 1: a proposal carries a price estimate to a vendor under the agency's name,
 * so it goes through the approval queue like any other outbound message. There is
 * deliberately no action here that sets `sent`.
 */
export const submitProposalForApproval = defineAction({
  input: z.object({ id: z.string().uuid() }),
  async handler(input, ctx) {
    const [p] = await ctx.tx
      .select({
        status: proposals.status,
        estimateLow: proposals.estimateLow,
        estimateHigh: proposals.estimateHigh,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
      })
      .from(proposals)
      .innerJoin(contacts, eq(contacts.id, proposals.contactId))
      .where(eq(proposals.id, input.id))
      .limit(1);
    if (!p) throw new ActionError("That proposal no longer exists.");
    if (p.status !== "draft") {
      throw new ActionError("Only a draft can be sent for approval.");
    }
    if (p.estimateLow === null || p.estimateHigh === null) {
      throw new ActionError(
        "There is no estimate on this proposal yet. A document that goes to a vendor with no figure on it is not ready to approve.",
      );
    }

    await ctx.tx
      .update(proposals)
      .set({ status: "in_approval" })
      .where(eq(proposals.id, input.id));

    await ctx.audit({
      kind: "edit",
      action: "Sent a proposal to the approval queue",
      target: `${p.firstName} ${p.lastName}`,
      entityType: "proposal",
      entityId: input.id,
    });

    revalidatePath("/proposals");
    revalidatePath("/approvals");
    return { status: "in_approval" as const };
  },
});

/** How it went. Only meaningful once the vendor has actually seen it. */
export const setProposalOutcome = defineAction({
  input: z.object({
    id: z.string().uuid(),
    outcome: z.enum(["won", "lost"]),
  }),
  async handler(input, ctx) {
    const [p] = await ctx.tx
      .select({
        status: proposals.status,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
      })
      .from(proposals)
      .innerJoin(contacts, eq(contacts.id, proposals.contactId))
      .where(eq(proposals.id, input.id))
      .limit(1);
    if (!p) throw new ActionError("That proposal no longer exists.");
    if (p.status !== "sent") {
      throw new ActionError(
        "An outcome only makes sense once the proposal has gone out. This one has not been sent yet.",
      );
    }

    await ctx.tx
      .update(proposals)
      .set({ status: input.outcome })
      .where(eq(proposals.id, input.id));

    await ctx.audit({
      kind: "edit",
      action: `Proposal marked ${input.outcome}`,
      target: `${p.firstName} ${p.lastName}`,
      entityType: "proposal",
      entityId: input.id,
    });

    revalidatePath("/proposals");
    revalidatePath("/dashboard");
    return { status: input.outcome };
  },
});

/**
 * Deleting a proposal — drafts only.
 *
 * Anything past draft has either been approved or been seen by a vendor, and both
 * are part of the record of what this agency told somebody their house was worth.
 */
export const deleteProposal = defineAction({
  input: z.object({ id: z.string().uuid() }),
  async handler(input, ctx) {
    const [p] = await ctx.tx
      .select({
        status: proposals.status,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
      })
      .from(proposals)
      .innerJoin(contacts, eq(contacts.id, proposals.contactId))
      .where(eq(proposals.id, input.id))
      .limit(1);
    if (!p) throw new ActionError("That proposal no longer exists.");
    if (p.status !== "draft") {
      throw new ActionError(
        "Only a draft can be deleted. Once a proposal has been approved or sent, it is a record of the figure a vendor was given.",
      );
    }

    await ctx.audit({
      kind: "edit",
      action: "Deleted a proposal draft",
      target: `${p.firstName} ${p.lastName}`,
      entityType: "proposal",
      entityId: input.id,
    });

    await ctx.tx.delete(proposals).where(eq(proposals.id, input.id));

    revalidatePath("/proposals");
    return { deleted: true };
  },
});

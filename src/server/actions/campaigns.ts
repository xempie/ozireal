"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq, isNull, isNotNull, or, desc, sql } from "drizzle-orm";
import { defineAction, ActionError } from "./action";
import {
  campaigns,
  campaignRecipients,
  listings,
  properties,
  suburbs,
  matches,
  contacts,
} from "@/db/schema";

/**
 * Starting a campaign.
 *
 * It is created as a DRAFT and nothing else. §7 is explicit that there is no path
 * from this screen to a send: a draft goes to the approval queue, a human approves
 * it, and consent is re-checked at the instant of sending — so "New campaign"
 * cannot be the first step of a send, only the first step of a draft.
 */
export const createCampaign = defineAction({
  input: z.object({
    name: z.string().trim().min(3, "Give the campaign a name").max(120),
    channel: z.enum(["email", "sms"]),
    listingId: z.union([z.string().uuid(), z.literal("")]).optional(),
    /** Seed the recipient list from the listing's existing matches. */
    seedFromMatches: z.coerce.boolean().default(false),
  }),
  async handler(input, ctx) {
    const listingId = input.listingId || null;
    let target = "no listing";

    if (listingId) {
      const [l] = await ctx.tx
        .select({
          id: listings.id,
          status: listings.status,
          street: properties.street,
          suburbName: suburbs.name,
        })
        .from(listings)
        .innerJoin(properties, eq(properties.id, listings.propertyId))
        .leftJoin(suburbs, eq(suburbs.id, properties.suburbId))
        .where(eq(listings.id, listingId))
        .limit(1);
      if (!l) throw new ActionError("That listing no longer exists.");
      target = `${l.street}${l.suburbName ? `, ${l.suburbName}` : ""}`;
    }

    if (input.seedFromMatches && !listingId) {
      throw new ActionError(
        "Pick a listing first — the recipient list is drawn from that listing's matches.",
      );
    }

    const [created] = await ctx.tx
      .insert(campaigns)
      .values({
        tenantId: ctx.tenantId,
        listingId,
        name: input.name,
        channel: input.channel,
        // Always. sentAt stays null until the send path writes it.
        status: "draft",
        createdByUserId: ctx.userId,
      })
      .returning({ id: campaigns.id });

    /**
     * Seeding recipients is a convenience, NOT a decision to contact anybody.
     *
     * Consent is deliberately not consulted here: it is checked at the instant of
     * sending (§7), because a contact who unsubscribes between the draft and the
     * send must be blocked and logged — and that only works if they are on the
     * list to be blocked. Filtering them out now would make the block invisible.
     */
    let seeded = 0;
    if (listingId && input.seedFromMatches) {
      const rows = await ctx.tx
        .select({ contactId: matches.contactId })
        .from(matches)
        .innerJoin(contacts, eq(contacts.id, matches.contactId))
        .where(
          and(
            // Matches belong to the property (0017); this listing is one campaign over it.
            sql`${matches.propertyId} = (select property_id from listings where id = ${listingId}::uuid)`,
            // A tombstoned or merged-away record is not a person to reach.
            isNull(contacts.tombstonedAt),
            isNull(contacts.mergedIntoId),
          ),
        )
        .orderBy(desc(matches.score))
        .limit(500);

      if (rows.length) {
        await ctx.tx
          .insert(campaignRecipients)
          .values(
            rows.map((r) => ({
              tenantId: ctx.tenantId,
              campaignId: created.id,
              contactId: r.contactId,
            })),
          )
          .onConflictDoNothing();
        seeded = rows.length;
      }
    }

    await ctx.audit({
      kind: "edit",
      action: `Started a ${input.channel} campaign draft`,
      target: `${input.name} — ${target}`,
      entityType: "campaign",
      entityId: created.id,
    });

    revalidatePath("/campaigns");
    revalidatePath("/dashboard");
    return { id: created.id, seeded };
  },
});

/* -------------------------------------------------- editing and removing */

/**
 * Renaming or re-pointing a campaign — drafts only.
 *
 * Once anything has been sent, the campaign is the label on a set of messages that
 * real people received. Changing its channel afterwards would make the recipient
 * rows describe an SMS run that went out by email.
 */
export const updateCampaign = defineAction({
  input: z.object({
    id: z.string().uuid(),
    name: z.string().trim().min(3, "Give the campaign a name").max(120),
    channel: z.enum(["email", "sms"]),
    listingId: z.union([z.string().uuid(), z.literal("")]).optional(),
  }),
  async handler(input, ctx) {
    const [c] = await ctx.tx
      .select({ status: campaigns.status, name: campaigns.name })
      .from(campaigns)
      .where(eq(campaigns.id, input.id))
      .limit(1);
    if (!c) throw new ActionError("That campaign no longer exists.");
    if (c.status !== "draft") {
      throw new ActionError(
        "Only a draft can be edited. Once a campaign is in approval or has sent, its name and channel describe messages that already exist.",
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
      .update(campaigns)
      .set({ name: input.name, channel: input.channel, listingId })
      .where(eq(campaigns.id, input.id));

    await ctx.audit({
      kind: "edit",
      action: "Updated a campaign draft",
      target: input.name,
      entityType: "campaign",
      entityId: input.id,
    });

    revalidatePath("/campaigns");
    revalidatePath("/dashboard");
    return { id: input.id };
  },
});

/**
 * Deleting a campaign.
 *
 * Refused as soon as one recipient row carries a `sent_at` or a `blocked_reason`.
 * Both are evidence: the first is proof a message went to a named person, the
 * second is proof the send gate stopped one because consent had lapsed (§7, rule 2)
 * — and the block is the more valuable of the two, because it is the record you
 * would have to produce if a send were ever challenged.
 */
export const deleteCampaign = defineAction({
  input: z.object({ id: z.string().uuid() }),
  async handler(input, ctx) {
    const [c] = await ctx.tx
      .select({ name: campaigns.name, status: campaigns.status })
      .from(campaigns)
      .where(eq(campaigns.id, input.id))
      .limit(1);
    if (!c) throw new ActionError("That campaign no longer exists.");

    const [evidence] = await ctx.tx
      .select({ id: campaignRecipients.id })
      .from(campaignRecipients)
      .where(
        and(
          eq(campaignRecipients.campaignId, input.id),
          or(
            isNotNull(campaignRecipients.sentAt),
            isNotNull(campaignRecipients.blockedReason),
          ),
        ),
      )
      .limit(1);
    if (evidence) {
      throw new ActionError(
        "This campaign has reached people, or was blocked from reaching them. Either way that is evidence and cannot be deleted — cancel it instead.",
      );
    }

    await ctx.audit({
      kind: "edit",
      action: "Deleted a campaign draft",
      target: c.name,
      entityType: "campaign",
      entityId: input.id,
    });

    // The recipient rows cascade; none of them carry a send or a block, or the
    // guard above would have refused.
    await ctx.tx.delete(campaigns).where(eq(campaigns.id, input.id));

    revalidatePath("/campaigns");
    revalidatePath("/dashboard");
    return { deleted: true };
  },
});

/**
 * Stopping a campaign that has already reached somebody.
 *
 * The counterpart to delete: nothing is removed, the status says it was stopped,
 * and every recipient row stays exactly as it is.
 */
export const cancelCampaign = defineAction({
  input: z.object({ id: z.string().uuid() }),
  async handler(input, ctx) {
    const [c] = await ctx.tx
      .select({ name: campaigns.name, status: campaigns.status })
      .from(campaigns)
      .where(eq(campaigns.id, input.id))
      .limit(1);
    if (!c) throw new ActionError("That campaign no longer exists.");
    if (c.status === "cancelled") throw new ActionError("That campaign is already cancelled.");
    if (c.status === "sent") {
      throw new ActionError("That campaign has finished sending. There is nothing left to stop.");
    }

    await ctx.tx
      .update(campaigns)
      .set({ status: "cancelled" })
      .where(eq(campaigns.id, input.id));

    await ctx.audit({
      kind: "reject",
      action: "Cancelled a campaign",
      target: c.name,
      entityType: "campaign",
      entityId: input.id,
      metadata: { from: c.status },
    });

    revalidatePath("/campaigns");
    revalidatePath("/dashboard");
    return { cancelled: true };
  },
});

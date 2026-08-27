"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq, isNull, desc } from "drizzle-orm";
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
            eq(matches.listingId, listingId),
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

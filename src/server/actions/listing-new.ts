"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { contacts, listings, listingContacts, properties } from "@/db/schema";
import { defineAction, ActionError, toE164, normaliseEmail } from "./action";
import {
  fullListingInput,
  insertProperty,
  insertListing,
  changeListingStatus,
} from "@/server/stock/write";

/**
 * The one "New listing" form (owner's request, 2026-11-05).
 *
 * In one transaction: the property (picked, or created), the listing, the contacts on
 * it (picked, or created on the spot) and, if "Go live" is ticked, publication. Every
 * rule comes from src/server/stock/write.ts, the same code the separate actions use,
 * so nothing here can disagree with them. A refusal anywhere saves nothing.
 *
 * New Homes listings are projects rather than addresses: the project name stands in
 * for the street on the property record, and the website shows the suburb only.
 */

export const createFullListing = defineAction({
  input: fullListingInput,
  async handler(input, ctx) {
    // 1. The property: the one picked, or a new record.
    let propertyId = input.propertyId;
    if (!propertyId) {
      const created = await insertProperty(
        {
          streetNumber: input.section === "new_homes" ? undefined : input.streetNumber,
          // A New Homes project has no single address; its name is the record's label.
          street: input.section === "new_homes" ? input.projectName! : input.street!,
          unit: input.section === "new_homes" ? undefined : input.unit,
          suburbId: input.suburbId!,
          propertyType: input.propertyType,
          status: "prospect",
          beds: input.beds,
          baths: input.baths,
          parking: input.parking,
          landAreaSqm: input.landAreaSqm,
        },
        ctx,
      );
      propertyId = created.id;
      if (input.floorAreaSqm) {
        await ctx.tx.update(properties).set({ floorAreaSqm: input.floorAreaSqm }).where(eq(properties.id, propertyId));
      }
    }

    // 2. The listing, always created as a draft.
    const listing = await insertListing(
      {
        propertyId,
        listingType: input.listingType,
        priceDisplay: input.priceDisplay,
        searchPriceMin: input.searchPriceMin,
        searchPriceMax: input.searchPriceMax,
        rentPw: input.rentPw,
        publicHeadline: input.publicHeadline,
        publicCopy: input.publicCopy,
      },
      ctx,
    );
    await ctx.tx
      .update(listings)
      .set({
        websiteSection: input.section,
        projectName: input.section === "new_homes" ? input.projectName : null,
        projectArea: input.section === "new_homes" ? input.projectArea || null : null,
        projectReady: input.section === "new_homes" ? input.projectReady : false,
        highlights: input.section === "new_homes" && input.highlights.length ? input.highlights : null,
      })
      .where(eq(listings.id, listing.id));

    // 3. Contacts: the ones picked, or new ones, checked for an existing match first.
    let created = 0;
    for (const link of input.contacts) {
      let contactId = link.contactId;
      if (!contactId && link.newContact) {
        const n = link.newContact;
        const email = normaliseEmail(n.email || null);
        const phone = toE164(n.phone || null);
        const [match] =
          email || phone
            ? await ctx.tx
                .select({ id: contacts.id })
                .from(contacts)
                .where(
                  and(
                    isNull(contacts.tombstonedAt),
                    isNull(contacts.mergedIntoId),
                    or(
                      email ? eq(contacts.emailNormalised, email) : undefined,
                      phone ? eq(contacts.phoneE164, phone) : undefined,
                    ),
                  ),
                )
                .limit(1)
            : [];
        if (match) contactId = match.id;
        else {
          const [c] = await ctx.tx
            .insert(contacts)
            .values({
              tenantId: ctx.tenantId,
              firstName: n.firstName,
              lastName: n.lastName,
              emailRaw: n.email || null,
              emailNormalised: email,
              phoneRaw: n.phone || null,
              phoneE164: phone,
              sourceChannel: "manual",
              ownerUserId: ctx.userId,
            })
            .returning({ id: contacts.id });
          contactId = c.id;
          created++;
        }
      } else if (contactId) {
        const [c] = await ctx.tx
          .select({ tombstonedAt: contacts.tombstonedAt, mergedIntoId: contacts.mergedIntoId })
          .from(contacts)
          .where(eq(contacts.id, contactId))
          .limit(1);
        if (!c || c.tombstonedAt || c.mergedIntoId) {
          throw new ActionError("One of the contacts can no longer be linked. Remove it and pick again.");
        }
      }
      await ctx.tx
        .insert(listingContacts)
        .values({ tenantId: ctx.tenantId, listingId: listing.id, contactId: contactId!, role: link.role })
        .onConflictDoNothing();
    }

    // 4. Go live, through the same checks as the Publish button.
    if (input.goLive) await changeListingStatus({ id: listing.id, status: "live" }, ctx);

    await ctx.audit({
      kind: input.goLive ? "publish" : "edit",
      action: `New listing (${input.section === "new_homes" ? "New Homes" : "advertised"})${input.goLive ? ", live" : ", draft"}`,
      target: input.projectName || listing.slug,
      entityType: "listing",
      entityId: listing.id,
      metadata: { contacts: input.contacts.length, newContacts: created },
    });
    revalidatePath("/contacts");
    revalidatePath("/new-homes-adelaide");
    return { id: listing.id, slug: listing.slug, live: input.goLive };
  },
});

/** Contacts for the picker: a light search, live records only. */
export const searchContactsForListing = defineAction({
  input: z.object({ q: z.string().trim().min(2).max(80) }),
  async handler(input, ctx) {
    const q = `%${input.q.replace(/[%_]/g, "")}%`;
    const digits = input.q.replace(/\D/g, "");
    return ctx.tx
      .select({
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        phone: contacts.phoneRaw,
        email: contacts.emailRaw,
      })
      .from(contacts)
      .where(
        and(
          isNull(contacts.tombstonedAt),
          isNull(contacts.mergedIntoId),
          sql`(${contacts.firstName} || ' ' || ${contacts.lastName}) ilike ${q}
              or ${contacts.emailRaw} ilike ${q}
              ${digits.length >= 4 ? sql`or regexp_replace(coalesce(${contacts.phoneRaw}, ''), '\\D', '', 'g') like ${"%" + digits + "%"}` : sql``}`,
        ),
      )
      .limit(8);
  },
});

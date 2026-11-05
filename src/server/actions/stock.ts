"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { defineAction, ActionError } from "./action";
import { optionalInt } from "./fields";
import { properties, listings, inspections, suburbs, contacts } from "@/db/schema";
import { enqueue } from "@/server/jobs/queues";
import { streetKey } from "@/lib/address";
import {
  PROPERTY_TYPES,
  slugify,
  revalidatePublicListings,
  propertyInput,
  insertProperty,
  listingInput,
  insertListing,
  listingStatusInput,
  changeListingStatus,
} from "@/server/stock/write";

/**
 * Creating stock — the physical asset, and the campaign to sell or let it.
 *
 * The two are separate on purpose (§4). A property is a thing that exists whether
 * or not it is on the market; a listing is a campaign with a start and an end. One
 * property has many listings over the years, and the property carries its own
 * status independently — which is why "New property" and "New listing" are
 * different buttons rather than one wizard.
 */


export const createProperty = defineAction({
  input: propertyInput,
  handler: async (input, ctx) => insertProperty(input, ctx),
});

/* ------------------------------------------------------------- listings */


export const createListing = defineAction({
  input: listingInput,
  handler: async (input, ctx) => insertListing(input, ctx),
});

/* --------------------------------------------------- editing and removing */

/**
 * Correcting a property.
 *
 * Status is deliberately absent from the create form's field list and optional
 * here. The values a PERSON decides — prospect, appraised, off_market — plus
 * archived are the only ones this accepts; "listed" and "sold" are facts about a
 * campaign, written when one goes live or settles. If a campaign currently owns
 * the status, a change is refused rather than silently dropped, because dropping
 * it would leave the agent looking at a select that does nothing.
 */
export const updateProperty = defineAction({
  input: z.object({
    id: z.string().uuid(),
    streetNumber: z.string().trim().max(20).optional(),
    street: z.string().trim().min(1, "Street is required").max(120),
    unit: z.string().trim().max(20).optional(),
    suburbId: z.string().uuid("Choose a suburb from the list"),
    postcode: z.string().trim().max(10).optional(),
    propertyType: z.enum(PROPERTY_TYPES),
    status: z.enum(["prospect", "appraised", "off_market", "archived"]).optional(),
    ownerContactId: z.union([z.string().uuid(), z.literal("")]).optional(),
    beds: optionalInt(0, 30),
    baths: optionalInt(0, 30),
    parking: optionalInt(0, 30),
    landAreaSqm: optionalInt(0, 10_000_000),
    internalNotes: z.string().trim().max(2000).optional(),
    internalPriceExpectation: z.string().trim().max(200).optional(),
  }),
  async handler(input, ctx) {
    const [current] = await ctx.tx
      .select({ id: properties.id, status: properties.status })
      .from(properties)
      .where(eq(properties.id, input.id))
      .limit(1);
    if (!current) throw new ActionError("That property no longer exists.");

    const campaignOwnsStatus = current.status === "listed" || current.status === "sold";
    if (input.status && campaignOwnsStatus && input.status !== current.status) {
      throw new ActionError(
        "That property's status is set by its campaign. Withdraw or settle the listing to change it.",
      );
    }

    const [suburb] = await ctx.tx
      .select({
        id: suburbs.id,
        name: suburbs.name,
        state: suburbs.state,
        postcode: suburbs.postcode,
      })
      .from(suburbs)
      .where(eq(suburbs.id, input.suburbId))
      .limit(1);
    if (!suburb) throw new ActionError("Pick a suburb from the list.");

    /**
     * The same duplicate-address refusal as creation, minus this row. Without the
     * exclusion, saving a property without touching its address would refuse
     * against itself.
     */
    const [clash] = await ctx.tx
      .select({ id: properties.id })
      .from(properties)
      .where(
        and(
          sql`${properties.id} <> ${input.id}`,
          eq(properties.street, input.street),
          eq(properties.suburbId, input.suburbId),
          input.streetNumber
            ? eq(properties.streetNumber, input.streetNumber)
            : sql`true`,
          input.unit ? eq(properties.unit, input.unit) : sql`${properties.unit} is null`,
        ),
      )
      .limit(1);
    if (clash) {
      throw new ActionError(
        "Another property in your stock already has that address. Properties cannot be merged, so two rows for one house would split its listing history permanently.",
      );
    }

    if (input.ownerContactId) {
      const [owner] = await ctx.tx
        .select({
          tombstonedAt: contacts.tombstonedAt,
          mergedIntoId: contacts.mergedIntoId,
        })
        .from(contacts)
        .where(eq(contacts.id, input.ownerContactId))
        .limit(1);
      if (!owner) throw new ActionError("That owner record no longer exists.");
      if (owner.mergedIntoId) {
        throw new ActionError(
          "That owner record was merged into another. Link the surviving record.",
        );
      }
      if (owner.tombstonedAt) {
        throw new ActionError("That owner asked to be removed and cannot be linked.");
      }
    }

    if (input.propertyType === "land" && (input.beds || input.baths)) {
      throw new ActionError("Land has no bedrooms or bathrooms — clear those fields.");
    }

    const address = [input.unit ? `${input.unit}/` : "", input.streetNumber, input.street]
      .filter(Boolean)
      .join(" ")
      .replace("/ ", "/");

    await ctx.tx
      .update(properties)
      .set({
        unit: input.unit || null,
        streetNumber: input.streetNumber || null,
        street: input.street,
        suburbId: input.suburbId,
        state: suburb.state,
        postcode: input.postcode || suburb.postcode || null,
        propertyType: input.propertyType,
        // Absent, or refused above — either way the campaign's fact survives.
        status: campaignOwnsStatus ? current.status : (input.status ?? current.status),
        beds: input.beds ?? null,
        baths: input.baths ?? null,
        parking: input.parking ?? null,
        landAreaSqm: input.landAreaSqm ?? null,
        ownerContactId: input.ownerContactId || null,
        internalNotes: input.internalNotes || null,
        internalPriceExpectation: input.internalPriceExpectation || null,
        updatedAt: new Date(),
      })
      .where(eq(properties.id, input.id));

    await ctx.audit({
      kind: "edit",
      action: "Updated a property",
      target: `${address}, ${suburb.name}`,
      entityType: "property",
      entityId: input.id,
    });

    revalidatePath("/properties");
    revalidatePath(`/properties/${input.id}`);
    revalidatePath("/dashboard");
    return { id: input.id };
  },
});

/**
 * Removing a property.
 *
 * Refused the moment any listing exists, and that is the important half. §16 keeps
 * sold and leased campaigns forever — they are the sold archive, the suburb-page
 * content and the site's organic equity — and every one of them hangs off this
 * row. Deleting the property is how that archive would quietly disappear. A
 * property that was never listed is genuinely just a typo, and deletes.
 */
export const deleteProperty = defineAction({
  input: z.object({ id: z.string().uuid() }),
  async handler(input, ctx) {
    const [p] = await ctx.tx
      .select({
        street: properties.street,
        streetNumber: properties.streetNumber,
        suburbName: suburbs.name,
      })
      .from(properties)
      .leftJoin(suburbs, eq(suburbs.id, properties.suburbId))
      .where(eq(properties.id, input.id))
      .limit(1);
    if (!p) throw new ActionError("That property no longer exists.");

    const [anyListing] = await ctx.tx
      .select({ id: listings.id })
      .from(listings)
      .where(eq(listings.propertyId, input.id))
      .limit(1);
    if (anyListing) {
      throw new ActionError(
        "This property has been listed, so it cannot be deleted — its campaigns are the sold archive. Set it to archived instead, which takes it out of the working list and keeps the history.",
      );
    }

    const target = `${[p.streetNumber, p.street].filter(Boolean).join(" ")}, ${p.suburbName ?? ""}`;

    // Audited BEFORE the delete: the audit row references the entity id, and
    // writing it afterwards would point at something that no longer exists.
    await ctx.audit({
      kind: "edit",
      action: "Deleted a property",
      target,
      entityType: "property",
      entityId: input.id,
    });

    await ctx.tx.delete(properties).where(eq(properties.id, input.id));

    revalidatePath("/properties");
    revalidatePath("/dashboard");
    return { deleted: true };
  },
});

/**
 * Correcting a listing.
 *
 * `listingType` is only editable while the campaign is a draft: switching a live
 * sale campaign to a rental would price it off the wrong field and change what the
 * public page says the property is. The slug is never touched — §16 says slugs are
 * stable and never reused, so a corrected address does not move the URL.
 */
export const updateListing = defineAction({
  input: z.object({
    id: z.string().uuid(),
    listingType: z.enum(["sale", "rent"]),
    method: z.string().trim().max(60).optional(),
    priceDisplay: z.string().trim().max(200).optional(),
    searchPriceMin: optionalInt(0, 50_000_000),
    searchPriceMax: optionalInt(0, 50_000_000),
    rentPw: optionalInt(0, 100_000),
    publicHeadline: z.string().trim().max(200).optional(),
    publicCopy: z.string().trim().max(6000).optional(),
    resultDisplay: z.string().trim().max(200).optional(),
  }),
  async handler(input, ctx) {
    const [l] = await ctx.tx
      .select({
        id: listings.id,
        status: listings.status,
        listingType: listings.listingType,
        publicCopy: listings.publicCopy,
        publicHeadline: listings.publicHeadline,
        slug: listings.slug,
      })
      .from(listings)
      .where(eq(listings.id, input.id))
      .limit(1);
    if (!l) throw new ActionError("That listing no longer exists.");

    if (input.listingType !== l.listingType && (l.status === "sold" || l.status === "leased")) {
      throw new ActionError(
        `A ${l.status} listing is a result and keeps its type. Start a new listing to advertise it again.`,
      );
    }

    /**
     * The database refuses a live listing with no price wording; refusing here
     * first turns a constraint name into the reason. Under-quoting provisions are
     * why the wording is required rather than merely recommended.
     */
    if (l.status !== "draft" && !input.priceDisplay) {
      throw new ActionError(
        "A live listing needs price wording. Write what buyers should see before saving.",
      );
    }

    if (
      input.searchPriceMin &&
      input.searchPriceMax &&
      input.searchPriceMin > input.searchPriceMax
    ) {
      throw new ActionError("The minimum search price is above the maximum.");
    }

    await ctx.tx
      .update(listings)
      .set({
        listingType: input.listingType,
        method: input.method || null,
        priceDisplay: input.priceDisplay || null,
        searchPriceMin: input.searchPriceMin ?? null,
        searchPriceMax: input.searchPriceMax ?? null,
        rentPw: input.rentPw ?? null,
        publicHeadline: input.publicHeadline || null,
        publicCopy: input.publicCopy || null,
        resultDisplay: input.resultDisplay || null,
        updatedAt: new Date(),
      })
      .where(eq(listings.id, input.id));

    await ctx.audit({
      kind: "edit",
      action: "Updated a listing",
      target: l.slug,
      entityType: "listing",
      entityId: input.id,
    });

    /**
     * Only re-embed when the text that gets embedded actually changed. The
     * embedding is what §6's stage 2 compares against, so stale copy means stale
     * matches — but re-embedding after a price-wording fix is money spent to
     * produce the identical vector.
     */
    const copyChanged =
      (input.publicCopy || null) !== l.publicCopy ||
      (input.publicHeadline || null) !== l.publicHeadline;
    if (copyChanged) {
      ctx.afterCommit(() =>
        enqueue("EmbedListing", { tenantId: ctx.tenantId, entityId: input.id }),
      );
    }

    revalidatePath("/listings");
    revalidatePath(`/listings/${input.id}`);
    revalidatePublicListings();
    revalidatePath("/dashboard");
    return { id: input.id, reembedding: copyChanged };
  },
});

/**
 * Moving a campaign through its lifecycle — the Publish and Withdraw buttons.
 *
 * Every transition also moves the PROPERTY's status, because that is the one thing
 * a person will never remember to do by hand, and a property still reading
 * "listed" after its campaign was withdrawn is what makes the pipeline counts
 * wrong.
 *
 * There is no transition back into 'draft'. A campaign that has been advertised
 * was advertised, and letting it return to draft would make the archive editable.
 */
export const setListingStatus = defineAction({
  input: listingStatusInput,
  handler: async (input, ctx) => changeListingStatus(input, ctx),
});

/**
 * Deleting a listing — drafts only.
 *
 * §16: sold and leased listings persist, and a withdrawn one is still a record of
 * what was advertised at what wording, which is exactly what an under-quoting
 * complaint asks about. A draft has never been seen by anybody, so it is the only
 * one that can be a mistake rather than a record.
 */
export const deleteListing = defineAction({
  input: z.object({ id: z.string().uuid() }),
  async handler(input, ctx) {
    const [l] = await ctx.tx
      .select({
        status: listings.status,
        slug: listings.slug,
        propertyId: listings.propertyId,
      })
      .from(listings)
      .where(eq(listings.id, input.id))
      .limit(1);
    if (!l) throw new ActionError("That listing no longer exists.");
    if (l.status !== "draft") {
      throw new ActionError(
        "Only a draft can be deleted. A campaign that has been advertised is a record of what was advertised — withdraw it instead, and it stays in the archive.",
      );
    }

    await ctx.audit({
      kind: "edit",
      action: "Deleted a draft listing",
      target: l.slug,
      entityType: "listing",
      entityId: input.id,
    });

    await ctx.tx.delete(listings).where(eq(listings.id, input.id));

    /**
     * Creating the listing flipped the property to "listed". If nothing else is
     * on the market for it, that claim is now false.
     */
    const [stillListed] = await ctx.tx
      .select({ id: listings.id })
      .from(listings)
      .where(
        and(
          eq(listings.propertyId, l.propertyId),
          sql`${listings.status} in ('live','under_offer')`,
        ),
      )
      .limit(1);
    if (!stillListed) {
      await ctx.tx
        .update(properties)
        .set({ status: "off_market", updatedAt: new Date() })
        .where(and(eq(properties.id, l.propertyId), eq(properties.status, "listed")));
    }

    revalidatePath("/listings");
    revalidatePublicListings();
    revalidatePath("/properties");
    revalidatePath("/dashboard");
    return { deleted: true };
  },
});

/* ---------------------------------------------------------- inspections */

/**
 * An open home or a private viewing.
 *
 * Public on the listing page once Phase 2B lands, and a registration writes an
 * interaction plus a contact (§4) — so this is a lead source, not a diary entry,
 * which is why it lives on the listing rather than in the calendar.
 */
export const createInspection = defineAction({
  input: z.object({
    listingId: z.string().uuid("Choose a listing"),
    startsAt: z.coerce.date(),
    minutes: z.coerce.number().int().min(5).max(8 * 60).default(30),
    kind: z.enum(["open", "private"]).default("open"),
    capacity: optionalInt(1, 1000),
  }),
  async handler(input, ctx) {
    if (Number.isNaN(input.startsAt.getTime())) {
      throw new ActionError("That start time could not be read.");
    }

    const [l] = await ctx.tx
      .select({ id: listings.id, status: listings.status, slug: listings.slug })
      .from(listings)
      .where(eq(listings.id, input.listingId))
      .limit(1);
    if (!l) throw new ActionError("That listing no longer exists.");
    if (l.status === "sold" || l.status === "leased" || l.status === "withdrawn") {
      throw new ActionError(
        "That campaign is closed. An inspection on it would be advertising a property that is no longer available.",
      );
    }

    const [created] = await ctx.tx
      .insert(inspections)
      .values({
        tenantId: ctx.tenantId,
        listingId: input.listingId,
        startsAt: input.startsAt,
        minutes: input.minutes,
        kind: input.kind,
        capacity: input.capacity ?? null,
      })
      .returning({ id: inspections.id });

    await ctx.audit({
      kind: "edit",
      action: `Scheduled an ${input.kind === "open" ? "open home" : "private inspection"}`,
      target: l.slug,
      entityType: "inspection",
      entityId: created.id,
    });

    revalidatePath(`/listings/${input.listingId}`);
    revalidatePath("/dashboard");
    return { id: created.id };
  },
});

/**
 * Cancelling an inspection.
 *
 * A flag rather than a delete, because people register for these. A registration
 * pointing at nothing would lose both the lead and the reason we hold their
 * details, and the row is what says the open home was ever advertised.
 */
export const cancelInspection = defineAction({
  input: z.object({ id: z.string().uuid() }),
  async handler(input, ctx) {
    const [i] = await ctx.tx
      .select({
        id: inspections.id,
        listingId: inspections.listingId,
        cancelled: inspections.cancelled,
        startsAt: inspections.startsAt,
      })
      .from(inspections)
      .where(eq(inspections.id, input.id))
      .limit(1);
    if (!i) throw new ActionError("That inspection no longer exists.");
    if (i.cancelled) throw new ActionError("That inspection is already cancelled.");

    await ctx.tx
      .update(inspections)
      .set({ cancelled: true })
      .where(eq(inspections.id, input.id));

    await ctx.audit({
      kind: "edit",
      action: "Cancelled an inspection",
      target: i.startsAt.toISOString(),
      entityType: "inspection",
      entityId: input.id,
    });

    revalidatePath(`/listings/${i.listingId}`);
    revalidatePath("/dashboard");
    return { cancelled: true };
  },
});


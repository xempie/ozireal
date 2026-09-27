"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { defineAction, ActionError } from "./action";
import { optionalInt } from "./fields";
import { properties, listings, inspections, suburbs, contacts } from "@/db/schema";
import { enqueue } from "@/server/jobs/queues";
import { streetKey } from "@/lib/address";

/**
 * Creating stock — the physical asset, and the campaign to sell or let it.
 *
 * The two are separate on purpose (§4). A property is a thing that exists whether
 * or not it is on the market; a listing is a campaign with a start and an end. One
 * property has many listings over the years, and the property carries its own
 * status independently — which is why "New property" and "New listing" are
 * different buttons rather than one wizard.
 */

const PROPERTY_TYPES = ["house", "unit", "townhouse", "land", "acreage", "commercial"] as const;

export const createProperty = defineAction({
  input: z.object({
    streetNumber: z.string().trim().max(20).optional(),
    street: z.string().trim().min(1, "Street is required").max(120),
    unit: z.string().trim().max(20).optional(),
    suburbId: z.string().uuid("Choose a suburb from the list"),
    postcode: z.string().trim().max(10).optional(),
    propertyType: z.enum(PROPERTY_TYPES),
    /**
     * Only the pre-listing states. "listed" is a fact about a campaign, "sold"
     * about a settlement — a property claiming either with no listing behind it
     * is a lie the pipeline counts read. Being a subset of the pgEnum, this can
     * never be rejected by Postgres.
     */
    status: z.enum(["prospect", "appraised", "off_market"]).default("prospect"),
    ownerContactId: z.union([z.string().uuid(), z.literal("")]).optional(),
    // .int() so "3.5" comes back as a field error rather than a Postgres type error.
    beds: optionalInt(0, 30),
    baths: optionalInt(0, 30),
    parking: optionalInt(0, 30),
    landAreaSqm: optionalInt(0, 10_000_000),
    /** Internal only — rule 8. Never returned by a public route. */
    internalNotes: z.string().trim().max(2000).optional(),
    internalPriceExpectation: z.string().trim().max(200).optional(),
  }),
  async handler(input, ctx) {
    /**
     * The suburb is a real foreign key, not free text. §6's stage-1 matching
     * filter is a suburb equality check, so "Nth Adelaide" typed by hand would
     * drop the property out of every match without ever erroring.
     */
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

    const address = [input.unit ? `${input.unit}/` : "", input.streetNumber, input.street]
      .filter(Boolean)
      .join(" ")
      .replace("/ ", "/");

    /**
     * A duplicate address is REFUSED — the opposite of the contact rule, and
     * deliberately so.
     *
     * A duplicate contact is allowed to exist because losing an enquiry is worse,
     * and a merge review lets a human resolve it later. Stock has no such path:
     * there is no property merge, and two rows for one house permanently split
     * the listing history that §4 keeps properties and listings separate tables
     * in order to preserve. The unit number is part of the comparison, so six
     * flats at one street address remain six properties.
     */
    // Same suburb, number and unit, then the street compared by streetKey, so
    // "Omer St" and "Omer Street" are recognised as one address.
    const sameSpot = await ctx.tx
      .select({ id: properties.id, street: properties.street })
      .from(properties)
      .where(
        and(
          eq(properties.suburbId, input.suburbId),
          input.streetNumber
            ? eq(properties.streetNumber, input.streetNumber)
            : sql`true`,
          input.unit ? eq(properties.unit, input.unit) : sql`${properties.unit} is null`,
        ),
      );
    const existing = sameSpot.find((p) => streetKey(p.street) === streetKey(input.street));
    if (existing) {
      throw new ActionError(
        "That address is already in your stock. Open the existing record rather than creating a second one — a property cannot be merged later.",
      );
    }

    /** An owner link must point at a record that still takes activity. */
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
        throw new ActionError("That owner record was merged into another. Link the surviving record.");
      }
      if (owner.tombstonedAt) {
        throw new ActionError("That owner asked to be removed and cannot be linked.");
      }
    }

    // A land parcel with three bedrooms is a data-entry slip, and it would then
    // match buyers looking for a house.
    if (input.propertyType === "land" && (input.beds || input.baths)) {
      throw new ActionError("Land has no bedrooms or bathrooms — clear those fields.");
    }

    const [created] = await ctx.tx
      .insert(properties)
      .values({
        tenantId: ctx.tenantId,
        unit: input.unit || null,
        streetNumber: input.streetNumber || null,
        street: input.street,
        suburbId: input.suburbId,
        /**
         * From the SUBURB row, never a literal. §10 says jurisdiction rules are
         * per-tenant configuration and must never be hardcoded — writing "SA"
         * here is exactly how "add NSW later" turns into a rewrite.
         */
        state: suburb.state,
        postcode: input.postcode || suburb.postcode || null,
        propertyType: input.propertyType,
        status: input.status,
        beds: input.beds ?? null,
        baths: input.baths ?? null,
        parking: input.parking ?? null,
        landAreaSqm: input.landAreaSqm ?? null,
        ownerContactId: input.ownerContactId || null,
        internalNotes: input.internalNotes || null,
        internalPriceExpectation: input.internalPriceExpectation || null,
      })
      .returning({ id: properties.id });

    await ctx.audit({
      kind: "edit",
      action: "Added a property",
      target: `${address}, ${suburb.name}`,
      entityType: "property",
      entityId: created.id,
    });

    revalidatePath("/properties");
    revalidatePath("/dashboard");
    return { id: created.id, address: `${address}, ${suburb.name}` };
  },
});

/* ------------------------------------------------------------- listings */

/** "12 Powell Street, Norwood" -> "12-powell-street-norwood" */
function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

export const createListing = defineAction({
  input: z.object({
    propertyId: z.string().uuid("Choose a property"),
    listingType: z.enum(["sale", "rent"]),
    method: z.string().trim().max(60).optional(),
    /**
     * The advertised wording, verbatim. Under-quoting provisions make the
     * displayed text a legal artefact, so it is authored by a person and stored
     * as typed — never composed from a number.
     */
    priceDisplay: z.string().trim().max(200).optional(),
    searchPriceMin: optionalInt(0, 50_000_000),
    searchPriceMax: optionalInt(0, 50_000_000),
    rentPw: optionalInt(0, 100_000),
    publicHeadline: z.string().trim().max(200).optional(),
    publicCopy: z.string().trim().max(6000).optional(),
  }),
  async handler(input, ctx) {
    const [prop] = await ctx.tx
      .select({
        id: properties.id,
        unit: properties.unit,
        streetNumber: properties.streetNumber,
        street: properties.street,
        suburbName: suburbs.name,
      })
      .from(properties)
      .leftJoin(suburbs, eq(suburbs.id, properties.suburbId))
      .where(eq(properties.id, input.propertyId))
      .limit(1);
    if (!prop) throw new ActionError("That property no longer exists.");

    /**
     * At most one live campaign per property — the database enforces it with a
     * partial unique index, and catching it here means a sentence the agent can
     * act on rather than a constraint name.
     */
    const [live] = await ctx.tx
      .select({ id: listings.id, status: listings.status })
      .from(listings)
      .where(
        and(
          eq(listings.propertyId, input.propertyId),
          sql`${listings.status} in ('live','under_offer')`,
        ),
      )
      .limit(1);
    if (live) {
      throw new ActionError(
        "That property already has a live campaign. Withdraw it before starting another.",
      );
    }

    if (input.searchPriceMin && input.searchPriceMax && input.searchPriceMin > input.searchPriceMax) {
      throw new ActionError("The minimum search price is above the maximum.");
    }

    const address = [prop.unit ? `${prop.unit}/` : "", prop.streetNumber, prop.street]
      .filter(Boolean)
      .join(" ")
      .replace("/ ", "/");

    /**
     * Slugs are stable and NEVER reused, so an old link can never land on
     * someone else's property. A collision gets a numeric suffix rather than
     * silently overwriting.
     */
    const base = slugify(`${address} ${prop.suburbName ?? ""}`);
    let slug = base;
    for (let n = 2; n < 50; n++) {
      const [clash] = await ctx.tx
        .select({ id: listings.id })
        .from(listings)
        .where(and(eq(listings.tenantId, ctx.tenantId), eq(listings.slug, slug)))
        .limit(1);
      if (!clash) break;
      slug = `${base}-${n}`;
    }

    const [created] = await ctx.tx
      .insert(listings)
      .values({
        tenantId: ctx.tenantId,
        propertyId: input.propertyId,
        listingType: input.listingType,
        method: input.method || null,
        // Always draft. Going live is a separate, deliberate act — and a live
        // listing without price wording is refused by the database anyway.
        status: "draft",
        priceDisplay: input.priceDisplay || null,
        searchPriceMin: input.searchPriceMin ?? null,
        searchPriceMax: input.searchPriceMax ?? null,
        rentPw: input.rentPw ?? null,
        publicHeadline: input.publicHeadline || null,
        publicCopy: input.publicCopy || null,
        slug,
      })
      .returning({ id: listings.id });

    // The property is now on the market, which is a fact about the ASSET.
    await ctx.tx
      .update(properties)
      .set({ status: "listed", updatedAt: new Date() })
      .where(eq(properties.id, input.propertyId));

    await ctx.audit({
      kind: "edit",
      action: `Created a ${input.listingType} listing`,
      target: `${address}, ${prop.suburbName ?? ""}`,
      entityType: "listing",
      entityId: created.id,
    });

    // Embed and match once there is copy worth comparing against.
    ctx.afterCommit(() => enqueue("EmbedListing", { tenantId: ctx.tenantId, entityId: created.id }));

    revalidatePath("/listings");
    revalidatePath("/properties");
    revalidatePath("/dashboard");
    return { id: created.id, slug };
  },
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

    if (input.listingType !== l.listingType && l.status !== "draft") {
      throw new ActionError(
        "A campaign that has gone live cannot change between sale and rent. Withdraw it and start a new one.",
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
  input: z.object({
    id: z.string().uuid(),
    status: z.enum(["live", "under_offer", "sold", "leased", "withdrawn"]),
    /** Only where the agent chooses to display a result. Never composed from a number. */
    resultDisplay: z.string().trim().max(200).optional(),
  }),
  async handler(input, ctx) {
    const [l] = await ctx.tx
      .select({
        id: listings.id,
        propertyId: listings.propertyId,
        status: listings.status,
        listingType: listings.listingType,
        priceDisplay: listings.priceDisplay,
        publishedAt: listings.publishedAt,
        resultDisplay: listings.resultDisplay,
        slug: listings.slug,
      })
      .from(listings)
      .where(eq(listings.id, input.id))
      .limit(1);
    if (!l) throw new ActionError("That listing no longer exists.");
    if (l.status === input.status) {
      throw new ActionError("That campaign is already in that state.");
    }
    if (l.status === "sold" || l.status === "leased") {
      throw new ActionError(
        "That campaign has settled. It stays in the archive as it was — start a new listing if the property comes back to market.",
      );
    }

    /** A sale settles; a rental is let. Crossing them mislabels the archive. */
    const settled = l.listingType === "sale" ? "sold" : "leased";
    if ((input.status === "sold" || input.status === "leased") && input.status !== settled) {
      throw new ActionError(
        l.listingType === "sale"
          ? "This is a sale campaign — mark it sold rather than leased."
          : "This is a rental campaign — mark it leased rather than sold.",
      );
    }

    const goingLive = input.status === "live" || input.status === "under_offer";

    if (goingLive) {
      if (!l.priceDisplay) {
        throw new ActionError(
          "A live listing needs price wording. Write what buyers should see, then publish.",
        );
      }
      /**
       * At most one live campaign per property. The partial unique index enforces
       * it; catching it here means a sentence naming the fix.
       */
      const [otherLive] = await ctx.tx
        .select({ id: listings.id })
        .from(listings)
        .where(
          and(
            eq(listings.propertyId, l.propertyId),
            sql`${listings.id} <> ${l.id}`,
            sql`${listings.status} in ('live','under_offer')`,
          ),
        )
        .limit(1);
      if (otherLive) {
        throw new ActionError(
          "That property already has a live campaign. Withdraw it before publishing this one.",
        );
      }
    }

    const now = new Date();
    const settling = input.status === "sold" || input.status === "leased";
    await ctx.tx
      .update(listings)
      .set({
        status: input.status,
        // First publication only. A withdraw-and-republish keeps the original
        // date, because that is when the market first saw it.
        publishedAt: goingLive ? (l.publishedAt ?? now) : l.publishedAt,
        soldAt: settling ? now : null,
        // Left alone unless this transition supplies one, so withdrawing does not
        // wipe a result someone already authored.
        resultDisplay: input.resultDisplay ? input.resultDisplay : l.resultDisplay,
        updatedAt: now,
      })
      .where(eq(listings.id, input.id));

    /**
     * The property's own status follows. Withdrawing returns it to off_market
     * rather than to prospect — it has been appraised and advertised, and
     * "prospect" would put it back in the prospecting list.
     */
    const propertyStatus =
      input.status === "sold" ? "sold" : goingLive ? "listed" : "off_market";
    await ctx.tx
      .update(properties)
      .set({ status: propertyStatus, updatedAt: now })
      .where(eq(properties.id, l.propertyId));

    await ctx.audit({
      kind: input.status === "live" ? "publish" : "edit",
      action: `Listing moved to ${input.status.replace("_", " ")}`,
      target: l.slug,
      entityType: "listing",
      entityId: input.id,
      metadata: { from: l.status, to: input.status },
    });

    revalidatePath("/listings");
    revalidatePath(`/listings/${input.id}`);
    revalidatePath("/properties");
    revalidatePath(`/properties/${l.propertyId}`);
    revalidatePath("/dashboard");
    revalidatePath("/website");
    return { status: input.status };
  },
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

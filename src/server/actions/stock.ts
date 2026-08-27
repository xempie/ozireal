"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { defineAction, ActionError } from "./action";
import { optionalInt } from "./fields";
import { properties, listings, suburbs, contacts } from "@/db/schema";
import { enqueue } from "@/server/jobs/queues";

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
    const [existing] = await ctx.tx
      .select({ id: properties.id })
      .from(properties)
      .where(
        and(
          eq(properties.street, input.street),
          eq(properties.suburbId, input.suburbId),
          input.streetNumber
            ? eq(properties.streetNumber, input.streetNumber)
            : sql`true`,
          input.unit ? eq(properties.unit, input.unit) : sql`${properties.unit} is null`,
        ),
      )
      .limit(1);
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

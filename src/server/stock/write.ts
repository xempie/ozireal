import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { ActionError, type ActionContext } from "@/server/actions/action";
import { optionalInt } from "@/server/actions/fields";
import { properties, listings, suburbs, contacts, LISTING_CONTACT_ROLES } from "@/db/schema";
import { enqueue } from "@/server/jobs/queues";
import { streetKey } from "@/lib/address";

/**
 * The stock writes behind the property and listing actions (moved here 2026-11-05).
 *
 * Properties and listings stay separate records (§4); what changed is that one
 * "New listing" form now creates both, attaches contacts and can go live in a single
 * transaction. Keeping the rules here, rather than copying them into that form's
 * action, means the duplicate-address refusal, the never-reused slug and the
 * one-live-campaign and price-wording checks cannot drift apart.
 *
 * Not a "use server" module on purpose: every export here would otherwise become a
 * callable endpoint with no input validation. Only src/server/actions/* call these.
 */

export const PROPERTY_TYPES = ["house", "unit", "townhouse", "land", "acreage", "commercial"] as const;

export const propertyInput = z.object({
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
  });

export async function insertProperty(input: z.infer<typeof propertyInput>, ctx: ActionContext) {
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

    // Every property is matched against every possible lead, whatever its status.
    ctx.afterCommit(() => enqueue("MatchProperty", { tenantId: ctx.tenantId, entityId: created.id }));

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
}

export const listingInput = z.object({
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
  });

export async function insertListing(input: z.infer<typeof listingInput>, ctx: ActionContext) {
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
}

export const listingStatusInput = z.object({
    id: z.string().uuid(),
    status: z.enum(["live", "under_offer", "sold", "leased", "withdrawn"]),
    /** Only where the agent chooses to display a result. Never composed from a number. */
    resultDisplay: z.string().trim().max(200).optional(),
  });

export async function changeListingStatus(input: z.infer<typeof listingStatusInput>, ctx: ActionContext) {
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
    revalidatePublicListings();
    return { status: input.status };
}

/** "12 Powell Street, Norwood" -> "12-powell-street-norwood" */
export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

/**
 * The public pages that show listings are pre-rendered, so a listing going live,
 * changing or being withdrawn must refresh them, or the home page keeps showing
 * yesterday's stock until the next deploy.
 */
export function revalidatePublicListings() {
  revalidatePath("/");
  revalidatePath("/for-sale");
  revalidatePath("/sold");
}

/* ------------------------------------------------- the one New listing form */

/*
 * Lives here, not in the "use server" action file: Next.js refuses a plain function
 * (the superRefine callback) inside a "use server" module as a non-async action.
 */
const contactLink = z.object({
  role: z.enum(LISTING_CONTACT_ROLES),
  contactId: z.string().uuid().optional(),
  newContact: z
    .object({
      firstName: z.string().trim().min(1, "First name").max(100),
      lastName: z.string().trim().max(100).default(""),
      phone: z.string().trim().max(40).default(""),
      email: z.string().trim().max(320).default(""),
    })
    .optional(),
});

export const fullListingInput = z
    .object({
      listingType: z.enum(["sale", "rent"]),
      section: z.enum(["advertised", "new_homes"]),
      goLive: z.boolean(),

      propertyId: z.string().uuid().optional(),
      streetNumber: z.string().trim().max(20).optional(),
      street: z.string().trim().max(120).optional(),
      unit: z.string().trim().max(20).optional(),
      suburbId: z.string().uuid().optional(),
      propertyType: z.enum(PROPERTY_TYPES),
      beds: optionalInt(0, 30),
      baths: optionalInt(0, 30),
      parking: optionalInt(0, 30),
      landAreaSqm: optionalInt(0, 10_000_000),
      floorAreaSqm: optionalInt(0, 100_000),

      projectName: z.string().trim().max(120).optional(),
      projectArea: z.string().trim().max(60).optional(),
      projectReady: z.boolean().default(false),
      highlights: z.array(z.string().trim().min(1).max(60)).max(4).default([]),

      priceDisplay: z.string().trim().max(200).optional(),
      searchPriceMin: optionalInt(0, 50_000_000),
      searchPriceMax: optionalInt(0, 50_000_000),
      rentPw: optionalInt(0, 100_000),
      publicHeadline: z.string().trim().max(200).optional(),
      publicCopy: z.string().trim().max(6000).optional(),

      contacts: z.array(contactLink).max(30).default([]),
    })
    .superRefine((v, c) => {
      if (!v.propertyId && !v.suburbId) c.addIssue({ code: "custom", path: ["suburbId"], message: "Choose a suburb from the list" });
      if (v.section === "new_homes" && !v.projectName)
        c.addIssue({ code: "custom", path: ["projectName"], message: "Give the project a name" });
      if (v.section === "advertised" && !v.propertyId && !v.street)
        c.addIssue({ code: "custom", path: ["street"], message: "Street is required" });
      for (const [i, k] of v.contacts.entries())
        if (!k.contactId && !k.newContact)
          c.addIssue({ code: "custom", path: ["contacts", i], message: "Pick a contact or add a new one" });
    });

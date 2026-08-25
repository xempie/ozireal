import { and, eq, isNull, sql } from "drizzle-orm";
import { withTenant, type Tx } from "@/db";
import {
  contactPreferences,
  contactPreferenceSuburbs,
  contactIntent,
  contacts,
  listings,
  properties,
  suburbs,
} from "@/db/schema";
import {
  embedDocuments,
  embeddingsAvailable,
  toVectorLiteral,
  EMBED_MODEL,
} from "./embeddings";

/**
 * Building the text that gets embedded (B5.2).
 *
 * This is the part people skip, and it is the part that decides whether stage 2
 * earns its keep. A vector of "3 bed house Prospect 650000" is a worse version of
 * the SQL filter that already ran. What stage 2 is FOR is the soft signal — "quiet
 * street", "somewhere the dog can run", "needs to be walkable to the tram" — so the
 * composed text leads with that and mentions the hard numbers only as context.
 *
 * The text is stored alongside the vector so a human can read WHY two things were
 * judged similar. An unexplainable score is an unadopted feature (§6's point about
 * the reason string, applied one stage earlier).
 */

/**
 * Does this database actually have pgvector, AND the columns that depend on it?
 *
 * Two corrections from the B5 review:
 *
 *   - the answer is cached for a MINUTE, not for the life of the process. A
 *     long-running worker that started before the extension was installed would
 *     otherwise keep reporting "no vector search" until someone restarted it, and
 *     match_runs would keep recording that as fact.
 *   - the extension existing is not enough. Migration 0010 adds the columns only
 *     when pgvector was present AT MIGRATION TIME, so installing it afterwards
 *     leaves `extname = vector` true and `listings.embedding` absent — and every
 *     vector query then fails at runtime. Both must be true.
 */
let pgvectorChecked: { value: boolean; at: number } | null = null;
const PGVECTOR_TTL_MS = 60_000;

export async function hasPgvector(tx: Tx): Promise<boolean> {
  if (pgvectorChecked && Date.now() - pgvectorChecked.at < PGVECTOR_TTL_MS) {
    return pgvectorChecked.value;
  }
  const rows = await tx.execute<{ present: boolean }>(
    sql`select
          exists (select 1 from pg_extension where extname = 'vector')
          and exists (
            select 1 from information_schema.columns
            where table_name = 'listings' and column_name = 'embedding'
          )
          and exists (
            select 1 from information_schema.columns
            where table_name = 'contact_preferences' and column_name = 'embedding'
          ) as present`,
  );
  const value = rows[0]?.present ?? false;
  pgvectorChecked = { value, at: Date.now() };
  return value;
}

/** Test seam: the check is cached, so a test that installs the extension can reset. */
export function resetPgvectorCache() {
  pgvectorChecked = null;
}

export function buildPreferenceText(p: {
  firstName: string;
  roles: string[];
  softRequirements: string | null;
  timeline: string | null;
  financeStatus: string | null;
  suburbs: string[];
  propertyTypes: string[];
  priceMin: number | null;
  priceMax: number | null;
  bedsMin: number | null;
  bathsMin: number | null;
  parkingMin: number | null;
  brief: string | null;
}): string {
  const parts: string[] = [];

  // Soft requirements first: this is the signal filters cannot express, and
  // position matters to an embedding.
  if (p.softRequirements) parts.push(`Looking for: ${p.softRequirements}`);
  if (p.brief) parts.push(p.brief);

  const wants: string[] = [];
  if (p.propertyTypes.length) wants.push(p.propertyTypes.join(" or "));
  if (p.bedsMin) wants.push(`${p.bedsMin}+ bedrooms`);
  if (p.bathsMin) wants.push(`${p.bathsMin}+ bathrooms`);
  if (p.parkingMin) wants.push(`parking for ${p.parkingMin}`);
  if (wants.length) parts.push(`Requirements: ${wants.join(", ")}.`);

  if (p.suburbs.length) parts.push(`Suburbs: ${p.suburbs.join(", ")}.`);
  if (p.priceMax) {
    parts.push(
      `Budget: ${p.priceMin ? `$${p.priceMin.toLocaleString("en-AU")}–` : "up to $"}${p.priceMax.toLocaleString("en-AU")}.`,
    );
  }
  if (p.timeline) parts.push(`Timeline: ${p.timeline}.`);
  if (p.financeStatus) parts.push(`Finance: ${p.financeStatus}.`);

  return parts.join(" ").slice(0, 6000);
}

export function buildListingText(l: {
  headline: string | null;
  copy: string | null;
  propertyType: string;
  suburb: string | null;
  beds: number | null;
  baths: number | null;
  parking: number | null;
  features: string[];
  priceDisplay: string | null;
}): string {
  const parts: string[] = [];
  if (l.headline) parts.push(l.headline);
  if (l.copy) parts.push(l.copy);

  const facts: string[] = [l.propertyType];
  if (l.beds) facts.push(`${l.beds} bed`);
  if (l.baths) facts.push(`${l.baths} bath`);
  if (l.parking) facts.push(`${l.parking} car`);
  if (l.suburb) facts.push(`in ${l.suburb}`);
  parts.push(facts.join(", ") + ".");

  if (l.features.length) parts.push(`Features: ${l.features.join(", ")}.`);
  // priceDisplay is the advertised wording verbatim — never composed from a number
  // (under-quoting provisions make it a legal artefact).
  if (l.priceDisplay) parts.push(l.priceDisplay);

  return parts.join(" ").slice(0, 6000);
}

/* ----------------------------------------------------------------- jobs */

export async function embedContactPreferences(tenantId: string, contactId: string) {
  if (!embeddingsAvailable()) return { skipped: "no-aws-credentials" };

  const ctx = await withTenant(tenantId, async (tx) => {
    const [c] = await tx
      .select({
        firstName: contacts.firstName,
        tombstonedAt: contacts.tombstonedAt,
        mergedIntoId: contacts.mergedIntoId,
      })
      .from(contacts)
      .where(eq(contacts.id, contactId))
      .limit(1);
    if (!c || c.tombstonedAt || c.mergedIntoId) return null;

    const [prefs] = await tx
      .select()
      .from(contactPreferences)
      .where(eq(contactPreferences.contactId, contactId))
      .limit(1);
    if (!prefs) return null;

    const subs = await tx
      .select({ name: suburbs.name })
      .from(contactPreferenceSuburbs)
      .innerJoin(suburbs, eq(suburbs.id, contactPreferenceSuburbs.suburbId))
      .where(eq(contactPreferenceSuburbs.preferenceId, prefs.id));

    const [intent] = await tx
      .select({ brief: contactIntent.rollingBrief })
      .from(contactIntent)
      .where(eq(contactIntent.contactId, contactId))
      .limit(1);

    return { c, prefs, subs: subs.map((s) => s.name), brief: intent?.brief ?? null };
  });

  if (!ctx) return { skipped: "no-preferences-or-gone" };

  const text = buildPreferenceText({
    firstName: ctx.c.firstName,
    roles: [],
    softRequirements: ctx.prefs.softRequirements,
    timeline: ctx.prefs.timeline,
    financeStatus: ctx.prefs.financeStatus,
    suburbs: ctx.subs,
    propertyTypes: ctx.prefs.propertyTypes ?? [],
    priceMin: ctx.prefs.priceMin,
    priceMax: ctx.prefs.priceMax,
    bedsMin: ctx.prefs.bedsMin,
    bathsMin: ctx.prefs.bathsMin,
    parkingMin: ctx.prefs.parkingMin,
    brief: ctx.brief,
  });

  // Nothing worth embedding is an honest outcome, not a failure.
  if (text.trim().length < 20) return { skipped: "nothing-to-embed" };

  return persist(tenantId, "contact_preferences", ctx.prefs.id, text, {
    type: "contact",
    id: contactId,
  });
}

export async function embedListing(tenantId: string, listingId: string) {
  if (!embeddingsAvailable()) return { skipped: "no-aws-credentials" };

  const ctx = await withTenant(tenantId, async (tx) => {
    const [row] = await tx
      .select({
        id: listings.id,
        headline: listings.publicHeadline,
        copy: listings.publicCopy,
        priceDisplay: listings.priceDisplay,
        propertyType: properties.propertyType,
        beds: properties.beds,
        baths: properties.baths,
        parking: properties.parking,
        features: properties.features,
        suburb: suburbs.name,
      })
      .from(listings)
      .innerJoin(properties, eq(properties.id, listings.propertyId))
      .leftJoin(suburbs, eq(suburbs.id, properties.suburbId))
      .where(eq(listings.id, listingId))
      .limit(1);
    return row ?? null;
  });

  if (!ctx) return { skipped: "gone" };

  const text = buildListingText({
    headline: ctx.headline,
    copy: ctx.copy,
    propertyType: ctx.propertyType,
    suburb: ctx.suburb,
    beds: ctx.beds,
    baths: ctx.baths,
    parking: ctx.parking,
    features: ctx.features ?? [],
    priceDisplay: ctx.priceDisplay,
  });

  if (text.trim().length < 20) return { skipped: "nothing-to-embed" };

  return persist(tenantId, "listings", listingId, text, {
    type: "listing",
    id: listingId,
  });
}

/**
 * Store the text always; store the vector only where the column exists.
 *
 * The asymmetry is the recovery plan: on a database without pgvector the job still
 * records what it WOULD have embedded, so pointing at one that has the extension
 * is `pnpm ai:embed` rather than re-deriving every listing from scratch.
 */
async function persist(
  tenantId: string,
  table: "contact_preferences" | "listings",
  rowId: string,
  text: string,
  entity: { type: string; id: string },
) {
  const vectorAvailable = await withTenant(tenantId, (tx) => hasPgvector(tx));

  /**
   * The identifier is chosen from a literal map, never interpolated from the
   * parameter. The union type already constrains it, but a type is a promise about
   * today's callers — this makes an unknown table name impossible to express at
   * all, which is the property that survives the next person editing this.
   */
  const target = table === "listings" ? sql.raw("listings") : sql.raw("contact_preferences");

  if (!vectorAvailable) {
    await withTenant(tenantId, (tx) =>
      tx.execute(
        sql`update ${target}
            set embedded_text = ${text}, embedding_model = ${EMBED_MODEL}
            where id = ${rowId}`,
      ),
    );
    return { embedded: false, reason: "pgvector-unavailable", textStored: true };
  }

  const [vector] = await embedDocuments(tenantId, [text], entity);
  await withTenant(tenantId, (tx) =>
    tx.execute(
      sql`update ${target}
          set embedding = ${toVectorLiteral(vector)}::vector,
              embedded_text = ${text},
              embedded_at = now(),
              embedding_model = ${EMBED_MODEL}
          where id = ${rowId}`,
    ),
  );
  return { embedded: true, dimensions: vector.length };
}

/** What still needs embedding — drives `pnpm ai:embed`. */
export async function pendingEmbeddings(tenantId: string) {
  return withTenant(tenantId, async (tx) => {
    const vectorAvailable = await hasPgvector(tx);
    // Without pgvector, "pending" means "no text recorded yet".
    const staleListings = await tx
      .select({ id: listings.id })
      .from(listings)
      .where(
        vectorAvailable
          ? sql`${listings.embeddedAt} is null and ${listings.status} in ('live','under_offer')`
          : and(isNull(listings.embeddedText), sql`${listings.status} in ('live','under_offer')`),
      );
    const stalePrefs = await tx
      .select({ contactId: contactPreferences.contactId })
      .from(contactPreferences)
      .innerJoin(contacts, eq(contacts.id, contactPreferences.contactId))
      .where(
        and(
          isNull(contacts.tombstonedAt),
          isNull(contacts.mergedIntoId),
          vectorAvailable
            ? isNull(contactPreferences.embeddedAt)
            : isNull(contactPreferences.embeddedText),
        ),
      );
    return {
      vectorAvailable,
      listings: staleListings.map((l) => l.id),
      contacts: stalePrefs.map((p) => p.contactId),
    };
  });
}

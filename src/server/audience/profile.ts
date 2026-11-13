import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Tx } from "@/db";
import {
  contactIntent,
  contactPreferenceSuburbs,
  contactPreferences,
  contactRoles,
  contacts,
  interactions,
  listings,
  properties,
  suburbs,
} from "@/db/schema";

/**
 * What the agency knows about a client and about a property, as compact text for the
 * model (2026-11-13). Shared by the audience finder and the email writer, so both read
 * the same facts: roles, tags, every enquiry in the person's own words, preferences
 * where recorded, the rolling brief, and when we last spoke.
 */

const money = (n: number | null | undefined) =>
  n == null ? null : n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}m` : `$${Math.round(n / 1000)}k`;
const day = (d: Date) => d.toISOString().slice(0, 10);
const clip = (s: string, n: number) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n) + "…" : t;
};
/** Tags that are bookkeeping, not facts about the person. */
const noiseTag = (t: string) => /\.(csv|xlsx|vcf)$|^export_|^imported/i.test(t.trim());

export type ClientProfile = { contactId: string; firstName: string; text: string };

export async function clientProfiles(tx: Tx, contactIds: string[], opts: { enquiries?: number; enquiryChars?: number } = {}) {
  if (!contactIds.length) return [] as ClientProfile[];
  const nEnq = opts.enquiries ?? 3;
  const chars = opts.enquiryChars ?? 350;

  const people = await tx
    .select({
      id: contacts.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      tags: contacts.tags,
      createdAt: contacts.createdAt,
      lives: contacts.suburb,
    })
    .from(contacts)
    .where(inArray(contacts.id, contactIds));

  const roles = await tx
    .select({ contactId: contactRoles.contactId, role: contactRoles.role })
    .from(contactRoles)
    .where(inArray(contactRoles.contactId, contactIds));

  const prefs = await tx
    .select()
    .from(contactPreferences)
    .where(inArray(contactPreferences.contactId, contactIds));
  const prefSubs = prefs.length
    ? await tx
        .select({ prefId: contactPreferenceSuburbs.preferenceId, name: suburbs.name })
        .from(contactPreferenceSuburbs)
        .innerJoin(suburbs, eq(suburbs.id, contactPreferenceSuburbs.suburbId))
        .where(inArray(contactPreferenceSuburbs.preferenceId, prefs.map((p) => p.id)))
    : [];

  const briefs = await tx
    .select({ contactId: contactIntent.contactId, brief: contactIntent.rollingBrief, intent: contactIntent.intentType })
    .from(contactIntent)
    .where(inArray(contactIntent.contactId, contactIds));

  const touches = await tx
    .select({
      contactId: interactions.contactId,
      direction: interactions.direction,
      channel: interactions.channel,
      subject: interactions.subject,
      body: interactions.body,
      at: interactions.occurredAt,
    })
    .from(interactions)
    .where(and(inArray(interactions.contactId, contactIds), isNull(interactions.tombstonedAt)))
    .orderBy(desc(interactions.occurredAt));

  return people.map((p) => {
    const r = roles.filter((x) => x.contactId === p.id).map((x) => x.role);
    const tags = (p.tags ?? []).filter((t) => !noiseTag(t));
    const pref = prefs.find((x) => x.contactId === p.id);
    const subs = pref ? prefSubs.filter((s) => s.prefId === pref.id).map((s) => s.name) : [];
    const b = briefs.find((x) => x.contactId === p.id);
    const mine = touches.filter((t) => t.contactId === p.id);
    const inbound = mine.filter((t) => t.direction === "in" && (t.body || t.subject)).slice(0, nEnq);
    const last = mine[0]?.at ?? null;

    const wants = pref
      ? [
          subs.length ? `suburbs ${subs.join(", ")}` : null,
          pref.postcodes?.length ? `postcodes ${pref.postcodes.join(", ")}` : null,
          pref.priceMin || pref.priceMax ? `budget ${money(pref.priceMin) ?? "?"}–${money(pref.priceMax) ?? "?"}` : null,
          pref.rentPwMax ? `rent up to $${pref.rentPwMax}/wk` : null,
          pref.bedsMin ? `${pref.bedsMin}+ bed` : null,
          pref.propertyTypes?.length ? pref.propertyTypes.join("/") : null,
          pref.timeline ? `timeline ${pref.timeline}` : null,
          pref.financeStatus ? `finance ${pref.financeStatus}` : null,
          pref.softRequirements ? `"${clip(pref.softRequirements, 200)}"` : null,
        ].filter(Boolean)
      : [];

    const lines = [
      `${p.firstName} ${p.lastName}`.trim(),
      r.length ? `Roles: ${r.join(", ")}` : null,
      tags.length ? `Tags: ${tags.join(", ")}` : null,
      p.lives ? `Lives in: ${p.lives}` : null,
      wants.length ? `Wants: ${wants.join("; ")}` : null,
      b?.brief ? `Brief: ${clip(b.brief, 300)}` : null,
      ...inbound.map((t) => `Enquiry ${day(t.at)}: ${clip([t.subject, t.body].filter(Boolean).join(" | "), chars)}`),
      `On file since ${day(p.createdAt)}${last ? `; last contact ${day(last)}` : ""}`,
    ].filter(Boolean);

    return { contactId: p.id, firstName: p.firstName, text: lines.join("\n") };
  });
}

/** The property as the model should know it: public facts plus the agent's price wording. */
export async function propertyProfile(tx: Tx, propertyId: string) {
  const [p] = await tx
    .select({
      street: sql<string>`trim(coalesce(${properties.unit} || '/', '') || coalesce(${properties.streetNumber} || ' ', '') || coalesce(${properties.street}, ''))`,
      suburb: suburbs.name,
      state: properties.state,
      type: properties.propertyType,
      beds: properties.beds,
      baths: properties.baths,
      parking: properties.parking,
      land: properties.landAreaSqm,
      floor: properties.floorAreaSqm,
    })
    .from(properties)
    .leftJoin(suburbs, eq(suburbs.id, properties.suburbId))
    .where(eq(properties.id, propertyId))
    .limit(1);
  if (!p) return null;
  const [l] = await tx
    .select({
      id: listings.id,
      type: listings.listingType,
      status: listings.status,
      section: listings.websiteSection,
      price: listings.priceDisplay,
      min: listings.searchPriceMin,
      max: listings.searchPriceMax,
      rentPw: listings.rentPw,
      headline: listings.publicHeadline,
      copy: listings.publicCopy,
      projectName: listings.projectName,
      highlights: listings.highlights,
    })
    .from(listings)
    .where(and(eq(listings.propertyId, propertyId), inArray(listings.status, ["live", "under_offer", "draft"])))
    .orderBy(sql`case ${listings.status} when 'live' then 0 when 'under_offer' then 1 else 2 end`, desc(listings.createdAt))
    .limit(1);

  const name = l?.section === "new_homes" && l.projectName ? l.projectName : p.street;
  const text = [
    `${name}, ${p.suburb ?? ""} ${p.state ?? ""}`.trim(),
    `Type: ${p.type}${l?.section === "new_homes" ? " (new build / off-the-plan project)" : ""}`,
    [p.beds != null && `${p.beds} bed`, p.baths != null && `${p.baths} bath`, p.parking != null && `${p.parking} car`, p.floor && `${p.floor} m² house`, p.land && `${p.land} m² land`]
      .filter(Boolean)
      .join(", ") || null,
    l ? `For ${l.type === "rent" ? "lease" : "sale"}` : "Off-market, not advertised",
    l?.price ? `Price wording (verbatim, the only price that may be quoted): ${l.price}` : "Price wording: none set",
    l?.min || l?.max ? `Price range for matching only (never quote): ${money(l?.min) ?? "?"}–${money(l?.max) ?? "?"}` : null,
    l?.rentPw ? `Rent: $${l.rentPw} per week` : null,
    l?.highlights?.length ? `Highlights: ${l.highlights.join(", ")}` : null,
    l?.headline ? `Headline: ${l.headline}` : null,
    l?.copy ? `Description: ${clip(l.copy, 1500)}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  return { text, listingId: l?.id ?? null, label: `${name}${p.suburb ? `, ${p.suburb}` : ""}`, listingType: l?.type ?? "sale" };
}

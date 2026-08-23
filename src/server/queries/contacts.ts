import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { query } from "@/db";
import {
  contacts,
  contactRoles,
  contactPreferences,
  contactPreferenceSuburbs,
  contactIntent,
  consents,
  interactions,
  mergeReviews,
  confirmItems,
  suburbs,
  users,
} from "@/db/schema";

/**
 * Contact reads.
 *
 * Shapes deliberately mirror what the screens already render, so converting a page is
 * a changed import rather than a rewrite. Every function goes through `query()`, which
 * opens a transaction with `app.tenant_id` set - RLS does the rest.
 */

export type ContactRow = Awaited<ReturnType<typeof getContacts>>[number];

export async function getContacts() {
  return query(async (tx) => {
    const rows = await tx
      .select({
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        email: contacts.emailRaw,
        phone: contacts.phoneRaw,
        suburb: contacts.suburb,
        source: contacts.sourceChannel,
        owner: users.name,
        lastFollowupAt: contacts.lastFollowupAt,
        lastFollowupOutcome: contacts.lastFollowupOutcome,
        followupDueAt: contacts.followupDueAt,
        doNotContact: contacts.doNotContact,
        createdAt: contacts.createdAt,
        intentType: contactIntent.intentType,
        sentiment: contactIntent.sentiment,
        confidence: contactIntent.confidence,
        budgetBand: contactIntent.budgetBand,
        priceMin: contactPreferences.priceMin,
        priceMax: contactPreferences.priceMax,
      })
      .from(contacts)
      .leftJoin(users, eq(users.id, contacts.ownerUserId))
      .leftJoin(contactIntent, eq(contactIntent.contactId, contacts.id))
      .leftJoin(contactPreferences, eq(contactPreferences.contactId, contacts.id))
      .where(isNull(contacts.tombstonedAt))
      .orderBy(contacts.createdAt);

    // Roles and consent badges are per-row lists; two grouped queries beat N+1.
    const roles = await tx
      .select({ contactId: contactRoles.contactId, role: contactRoles.role })
      .from(contactRoles);
    const consentRows = await tx
      .select({
        contactId: consents.contactId,
        channel: consents.channel,
        status: consents.status,
        occurredAt: consents.occurredAt,
      })
      .from(consents)
      .orderBy(consents.occurredAt);

    return rows.map((c) => ({
      ...c,
      roles: roles.filter((r) => r.contactId === c.id).map((r) => r.role),
      // Consents are append-only, so the CURRENT state is the latest row per channel.
      consents: latestPerChannel(consentRows.filter((k) => k.contactId === c.id)),
    }));
  });
}

function latestPerChannel(
  rows: { channel: string; status: string; occurredAt: Date }[],
) {
  const byChannel = new Map<string, { channel: string; status: string }>();
  for (const r of rows) byChannel.set(r.channel, { channel: r.channel, status: r.status });
  return [...byChannel.values()];
}

export async function getContact(id: string) {
  return query(async (tx) => {
    const [c] = await tx
      .select({
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        email: contacts.emailRaw,
        phone: contacts.phoneRaw,
        suburb: contacts.suburb,
        source: contacts.sourceChannel,
        owner: users.name,
        lastFollowupAt: contacts.lastFollowupAt,
        lastFollowupOutcome: contacts.lastFollowupOutcome,
        followupDueAt: contacts.followupDueAt,
        doNotContact: contacts.doNotContact,
        createdAt: contacts.createdAt,
      })
      .from(contacts)
      .leftJoin(users, eq(users.id, contacts.ownerUserId))
      .where(eq(contacts.id, id))
      .limit(1);
    if (!c) return null;

    const [intent] = await tx
      .select()
      .from(contactIntent)
      .where(eq(contactIntent.contactId, id))
      .limit(1);

    const [prefs] = await tx
      .select()
      .from(contactPreferences)
      .where(eq(contactPreferences.contactId, id))
      .limit(1);

    const prefSuburbs = prefs
      ? await tx
          .select({ name: suburbs.name })
          .from(contactPreferenceSuburbs)
          .innerJoin(suburbs, eq(suburbs.id, contactPreferenceSuburbs.suburbId))
          .where(eq(contactPreferenceSuburbs.preferenceId, prefs.id))
      : [];

    const roles = await tx
      .select({ role: contactRoles.role })
      .from(contactRoles)
      .where(eq(contactRoles.contactId, id));

    /**
     * Every consent row, newest first. The detail screen shows the full provenance
     * trail rather than only the current state, because that trail IS the defence if
     * a send is ever challenged.
     */
    const consentRows = await tx
      .select()
      .from(consents)
      .where(eq(consents.contactId, id))
      .orderBy(desc(consents.occurredAt));

    return {
      ...c,
      roles: roles.map((r) => r.role),
      intent: intent
        ? {
            type: intent.intentType,
            budgetBand: intent.budgetBand,
            timeline: intent.timeline,
            blockers: intent.blockers ?? [],
            sentiment: intent.sentiment,
            confidence: intent.confidence,
            brief: intent.rollingBrief,
            rebuiltAt: intent.rebuiltAt,
          }
        : null,
      preferences: prefs
        ? {
            suburbs: prefSuburbs.map((s) => s.name),
            priceMin: prefs.priceMin,
            priceMax: prefs.priceMax,
            bedsMin: prefs.bedsMin,
            bathsMin: prefs.bathsMin,
            parkingMin: prefs.parkingMin,
            propertyTypes: prefs.propertyTypes ?? [],
            timeline: prefs.timeline,
            financeStatus: prefs.financeStatus,
            softRequirements: prefs.softRequirements,
          }
        : null,
      consents: consentRows.map((k) => ({
        channel: k.channel,
        status: k.status,
        sourceForm: k.sourceForm,
        wordingShown: k.wordingShown,
        ip: k.ipAddress,
        at: k.occurredAt,
      })),
    };
  });
}

export async function getInteractionsFor(contactId: string) {
  return query((tx) =>
    tx
      .select({
        id: interactions.id,
        contactId: interactions.contactId,
        channel: interactions.channel,
        direction: interactions.direction,
        at: interactions.occurredAt,
        subject: interactions.subject,
        body: interactions.body,
        hasRaw: sql<boolean>`${interactions.rawS3Key} is not null`,
        listingId: interactions.listingId,
      })
      .from(interactions)
      .where(
        and(eq(interactions.contactId, contactId), isNull(interactions.tombstonedAt)),
      )
      .orderBy(desc(interactions.occurredAt)),
  );
}

/** Contacts whose follow-up is due, most overdue first. */
export async function getFollowupsDue() {
  return query((tx) =>
    tx
      .select({
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        suburb: contacts.suburb,
        lastFollowupOutcome: contacts.lastFollowupOutcome,
        followupDueAt: contacts.followupDueAt,
        sentiment: contactIntent.sentiment,
      })
      .from(contacts)
      .leftJoin(contactIntent, eq(contactIntent.contactId, contacts.id))
      .where(
        and(
          isNotNull(contacts.followupDueAt),
          eq(contacts.doNotContact, false),
          isNull(contacts.tombstonedAt),
          sql`${contacts.followupDueAt} <= now() + interval '1 day'`,
        ),
      )
      .orderBy(contacts.followupDueAt),
  );
}

/** The inbound feed across every channel. */
export async function getRecentEnquiries(limit = 6) {
  return query((tx) =>
    tx
      .select({
        id: interactions.id,
        contactId: interactions.contactId,
        contactName: sql<string>`${contacts.firstName} || ' ' || ${contacts.lastName}`,
        contactCreatedAt: contacts.createdAt,
        channel: interactions.channel,
        at: interactions.occurredAt,
        subject: interactions.subject,
        body: interactions.body,
      })
      .from(interactions)
      .innerJoin(contacts, eq(contacts.id, interactions.contactId))
      .where(
        and(eq(interactions.direction, "in"), isNull(interactions.tombstonedAt)),
      )
      .orderBy(desc(interactions.occurredAt))
      .limit(limit),
  );
}

export async function getMergeReviews() {
  return query(async (tx) => {
    const rows = await tx
      .select()
      .from(mergeReviews)
      .where(eq(mergeReviews.status, "open"))
      .orderBy(desc(mergeReviews.createdAt));

    const all = await tx.select().from(contacts);
    const byId = new Map(all.map((c) => [c.id, c]));

    return rows.map((m) => ({
      id: m.id,
      similarity: m.similarity,
      matchedOn: m.matchedOn,
      createdAt: m.createdAt,
      a: byId.get(m.contactAId)!,
      b: byId.get(m.contactBId)!,
    }));
  });
}

export async function getConfirmItems() {
  return query(async (tx) => {
    const rows = await tx
      .select({
        id: confirmItems.id,
        kind: confirmItems.kind,
        contactId: confirmItems.contactId,
        contactName: sql<string>`${contacts.firstName} || ' ' || ${contacts.lastName}`,
        summary: confirmItems.summary,
        before: confirmItems.beforeText,
        after: confirmItems.afterText,
        confidence: confirmItems.confidence,
        createdAt: confirmItems.createdAt,
        sourceInteractionId: confirmItems.sourceInteractionId,
      })
      .from(confirmItems)
      .innerJoin(contacts, eq(contacts.id, confirmItems.contactId))
      .where(eq(confirmItems.status, "pending"))
      .orderBy(desc(confirmItems.createdAt));

    const sources = await tx
      .select({
        id: interactions.id,
        subject: interactions.subject,
        body: interactions.body,
        at: interactions.occurredAt,
      })
      .from(interactions);
    const byId = new Map(sources.map((s) => [s.id, s]));

    return rows.map((r) => ({
      ...r,
      source: r.sourceInteractionId ? (byId.get(r.sourceInteractionId) ?? null) : null,
    }));
  });
}

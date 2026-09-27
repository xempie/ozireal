import { and, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
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
        mergedIntoId: contacts.mergedIntoId,
      })
      .from(contacts)
      .leftJoin(users, eq(users.id, contacts.ownerUserId))
      .where(eq(contacts.id, id))
      .limit(1);
    if (!c) return null;

    /**
     * Records merged into this one. Their interactions and consents stay attached to
     * them - both tables are append-only, so a merge supersedes rather than repoints -
     * which means the survivor's page has to go and get them, and has to say where
     * they came from rather than presenting them as its own.
     */
    const mergedIn = await tx
      .select({
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
      })
      .from(contacts)
      .where(eq(contacts.mergedIntoId, id));

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
    const historyIds = [id, ...mergedIn.map((m) => m.id)];
    const consentRows = await tx
      .select()
      .from(consents)
      .where(inArray(consents.contactId, historyIds))
      .orderBy(desc(consents.occurredAt));

    return {
      ...c,
      mergedIn,
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
            postcodes: prefs.postcodes ?? [],
            rentPwMax: prefs.rentPwMax,
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
      /**
       * Includes consent captured against records merged into this one. It has to:
       * a withdrawal recorded on the duplicate is still a withdrawal, and dropping it
       * because the row hangs off a superseded id would mean sending to someone who
       * asked us not to. When the send gate lands (B4) it reads this same union, and
       * the strictest state across it wins.
       */
      consents: consentRows.map((k) => ({
        id: k.id,
        channel: k.channel,
        status: k.status,
        sourceForm: k.sourceForm,
        wordingShown: k.wordingShown,
        ip: k.ipAddress,
        at: k.occurredAt,
        viaMergedRecord:
          k.contactId === id
            ? null
            : (mergedIn.find((m) => m.id === k.contactId) ?? null),
      })),
    };
  });
}

/**
 * The interaction log for one person — including history captured against records that
 * were merged into this one. Those rows keep their original contact_id (interactions
 * are append-only and cannot be repointed), so the union happens on read, and each row
 * says which record it came from rather than quietly presenting it as this one's.
 */
export async function getInteractionsFor(contactId: string) {
  return query(async (tx) => {
    const merged = await tx
      .select({
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
      })
      .from(contacts)
      .where(eq(contacts.mergedIntoId, contactId));

    const rows = await tx
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
        and(
          inArray(interactions.contactId, [contactId, ...merged.map((m) => m.id)]),
          isNull(interactions.tombstonedAt),
        ),
      )
      .orderBy(desc(interactions.occurredAt));

    return rows.map((r) => ({
      ...r,
      viaMergedRecord:
        r.contactId === contactId
          ? null
          : (merged.find((m) => m.id === r.contactId) ?? null),
    }));
  });
}

/**
 * Everyone matching can work for: live contacts with a preferences row, and a short
 * summary of what they want. The matcher joins on preferences, so a contact without
 * them cannot be matched and is not listed here.
 */
export async function getBuyersWithPreferences() {
  return query(async (tx) => {
    const rows = await tx
      .select({
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        doNotContact: contacts.doNotContact,
        priceMin: contactPreferences.priceMin,
        priceMax: contactPreferences.priceMax,
        rentPwMax: contactPreferences.rentPwMax,
        bedsMin: contactPreferences.bedsMin,
        propertyTypes: contactPreferences.propertyTypes,
        postcodes: contactPreferences.postcodes,
        softRequirements: contactPreferences.softRequirements,
        suburbs: sql<string[]>`coalesce((
          select array_agg(${suburbs.name} order by ${suburbs.name})
          from ${contactPreferenceSuburbs}
          join ${suburbs} on ${suburbs.id} = ${contactPreferenceSuburbs.suburbId}
          where ${contactPreferenceSuburbs.preferenceId} = ${contactPreferences.id}
        ), '{}')`,
      })
      .from(contacts)
      .innerJoin(contactPreferences, eq(contactPreferences.contactId, contacts.id))
      .where(and(isNull(contacts.tombstonedAt), isNull(contacts.mergedIntoId)))
      .orderBy(contacts.firstName, contacts.lastName);
    return rows;
  });
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

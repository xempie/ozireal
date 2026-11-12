import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { query } from "@/db";
import {
  approvalItems,
  campaignRecipients,
  campaigns,
  contacts,
  listings,
  matches,
  properties,
  suburbs,
} from "@/db/schema";
import { MATCHABLE_PROPERTY_STATUSES } from "@/server/matching/engine";

/**
 * The Matching board (2026-11-12): "who should I email today, about what?"
 *
 * For every property still being worked: its matches grouped the way the agent decides
 * (ready to email / worth a call / already contacted / weak), plus the newest batch of
 * drafts for it. Counts are worked out here from rows, never stored.
 */

export const STRONG = 0.8;
export const GOOD = 0.55;

export type BoardPerson = {
  contactId: string;
  name: string;
  score: number;
  reason: string;
  hasEmail: boolean;
  phone: string | null;
  /** Email consent as the latest consent row has it. */
  consent: "granted" | "revoked" | "never_given" | null;
  doNotContact: boolean;
  /** Last email sent to them about THIS property. */
  contactedAt: Date | null;
  /** Their last interaction of any kind. */
  lastTouch: Date | null;
  group: "ready" | "call" | "contacted" | "weak";
};

export type BoardDraft = {
  itemId: string | null;
  recipientId: string;
  contactId: string;
  name: string;
  status: "drafting" | "pending" | "sent" | "blocked" | "rejected" | "failed";
  subject: string | null;
  body: string | null;
  reviewNote: string | null;
  note: string | null;
};

export type BoardBatch = {
  campaignId: string;
  createdAt: Date;
  drafts: BoardDraft[];
};

export type BoardProperty = {
  id: string;
  label: string;
  suburb: string | null;
  status: string;
  beds: number | null;
  baths: number | null;
  parking: number | null;
  listing: { id: string; status: string; type: "sale" | "rent"; priceDisplay: string | null; photo: string | null } | null;
  people: BoardPerson[];
  counts: { strong: number; good: number; ready: number; call: number; contacted: number; weak: number };
  batch: BoardBatch | null;
};

export async function getMatchBoard(): Promise<{ properties: BoardProperty[]; cold: { contactId: string; name: string; best: string; days: number | null }[] }> {
  return query(async (tx) => {
    const props = await tx
      .select({
        id: properties.id,
        label: sql<string>`trim(coalesce(${properties.unit} || '/', '') || coalesce(${properties.streetNumber} || ' ', '') || coalesce(${properties.street}, ''))`,
        suburb: suburbs.name,
        status: properties.status,
        beds: properties.beds,
        baths: properties.baths,
        parking: properties.parking,
      })
      .from(properties)
      .leftJoin(suburbs, eq(suburbs.id, properties.suburbId))
      .where(inArray(properties.status, [...MATCHABLE_PROPERTY_STATUSES]));
    if (!props.length) return { properties: [], cold: [] };
    const propIds = props.map((p) => p.id);

    const ls = await tx
      .select({
        id: listings.id,
        propertyId: listings.propertyId,
        status: listings.status,
        type: listings.listingType,
        priceDisplay: listings.priceDisplay,
        createdAt: listings.createdAt,
        photo: sql<string | null>`(select m.s3_key from listing_media m where m.listing_id = ${listings.id} and m.kind = 'photo' order by m.sort_order, m.created_at limit 1)`,
      })
      .from(listings)
      .where(and(inArray(listings.propertyId, propIds), inArray(listings.status, ["live", "under_offer", "draft"])))
      .orderBy(desc(listings.createdAt));
    const rank = { live: 0, under_offer: 1, draft: 2 } as Record<string, number>;
    const listingFor = new Map<string, (typeof ls)[number]>();
    for (const l of ls) {
      const cur = listingFor.get(l.propertyId);
      if (!cur || rank[l.status] < rank[cur.status]) listingFor.set(l.propertyId, l);
    }

    const ms = await tx
      .select({
        propertyId: matches.propertyId,
        contactId: matches.contactId,
        score: matches.score,
        reason: matches.reason,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        email: contacts.emailRaw,
        phone: contacts.phoneRaw,
        doNotContact: contacts.doNotContact,
        consent: sql<"granted" | "revoked" | "never_given" | null>`(
          select c.status from consents c
          where c.contact_id = ${contacts.id} and c.channel = 'email'
          order by c.occurred_at desc limit 1)`,
        lastTouch: sql<Date | null>`(select max(i.occurred_at) from interactions i where i.contact_id = ${contacts.id})`,
      })
      .from(matches)
      .innerJoin(contacts, eq(contacts.id, matches.contactId))
      .where(
        and(
          inArray(matches.propertyId, propIds),
          sql`${contacts.tombstonedAt} is null and ${contacts.mergedIntoId} is null`,
        ),
      )
      .orderBy(desc(matches.score));

    // Emails already sent about each property, to each person.
    const sent = await tx
      .select({
        contactId: approvalItems.contactId,
        sentAt: approvalItems.sentAt,
        propertyId: sql<string | null>`coalesce(${campaigns.propertyId}, (select l.property_id from listings l where l.id = ${approvalItems.listingId}))`,
      })
      .from(approvalItems)
      .leftJoin(campaigns, eq(campaigns.id, approvalItems.campaignId))
      .where(and(eq(approvalItems.status, "sent"), eq(approvalItems.kind, "email"), isNotNull(approvalItems.contactId)));
    const sentKey = new Map<string, Date>();
    for (const s of sent) {
      if (!s.propertyId || !s.contactId || !s.sentAt) continue;
      const k = `${s.propertyId}:${s.contactId}`;
      const prev = sentKey.get(k);
      if (!prev || s.sentAt > prev) sentKey.set(k, s.sentAt);
    }

    // The newest batch per property, with each person's draft.
    const batchRows = await tx
      .select({
        campaignId: campaigns.id,
        propertyId: campaigns.propertyId,
        createdAt: campaigns.createdAt,
        recipientId: campaignRecipients.id,
        contactId: campaignRecipients.contactId,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        blocked: campaignRecipients.blockedReason,
        itemId: approvalItems.id,
        itemStatus: approvalItems.status,
        subject: approvalItems.draftSubject,
        body: approvalItems.draftBody,
        reviewNote: approvalItems.reviewNote,
        blockReason: approvalItems.blockReason,
      })
      .from(campaigns)
      .innerJoin(campaignRecipients, eq(campaignRecipients.campaignId, campaigns.id))
      .innerJoin(contacts, eq(contacts.id, campaignRecipients.contactId))
      .leftJoin(approvalItems, eq(approvalItems.id, campaignRecipients.approvalItemId))
      .where(and(inArray(campaigns.propertyId, propIds), inArray(campaigns.status, ["draft", "in_approval", "sending", "sent"])))
      .orderBy(desc(campaigns.createdAt));
    const newest = new Map<string, string>();
    for (const b of batchRows) if (b.propertyId && !newest.has(b.propertyId)) newest.set(b.propertyId, b.campaignId);

    const out: BoardProperty[] = props.map((p) => {
      const l = listingFor.get(p.id) ?? null;
      const people: BoardPerson[] = ms
        .filter((m) => m.propertyId === p.id)
        .map((m) => {
          const contactedAt = sentKey.get(`${p.id}:${m.contactId}`) ?? null;
          const emailable = !!m.email && m.consent === "granted" && !m.doNotContact;
          const group: BoardPerson["group"] = contactedAt
            ? "contacted"
            : m.score < GOOD
              ? "weak"
              : emailable
                ? "ready"
                : "call";
          return {
            contactId: m.contactId,
            name: `${m.firstName} ${m.lastName}`.trim(),
            score: m.score,
            reason: m.reason,
            hasEmail: !!m.email,
            phone: m.phone,
            consent: m.consent,
            doNotContact: m.doNotContact,
            contactedAt,
            lastTouch: m.lastTouch ? new Date(m.lastTouch) : null,
            group,
          };
        });

      const cid = newest.get(p.id);
      const rows = cid ? batchRows.filter((b) => b.campaignId === cid) : [];
      const batch: BoardBatch | null =
        cid && rows.length
          ? {
              campaignId: cid,
              createdAt: rows[0].createdAt,
              drafts: rows.map((r) => ({
                itemId: r.itemId,
                recipientId: r.recipientId,
                contactId: r.contactId,
                name: `${r.firstName} ${r.lastName}`.trim(),
                status: r.itemId
                  ? ((r.itemStatus === "approved" ? "pending" : r.itemStatus) as BoardDraft["status"])
                  : r.blocked
                    ? "failed"
                    : "drafting",
                subject: r.subject,
                body: r.body,
                reviewNote: r.reviewNote,
                note: r.blockReason ?? r.blocked,
              })),
            }
          : null;

      return {
        ...p,
        listing: l ? { id: l.id, status: l.status, type: l.type, priceDisplay: l.priceDisplay, photo: l.photo } : null,
        people,
        counts: {
          strong: people.filter((x) => x.score >= STRONG).length,
          good: people.filter((x) => x.score >= GOOD && x.score < STRONG).length,
          ready: people.filter((x) => x.group === "ready").length,
          call: people.filter((x) => x.group === "call").length,
          contacted: people.filter((x) => x.group === "contacted").length,
          weak: people.filter((x) => x.group === "weak").length,
        },
        // A batch that is fully settled stays visible as history, not as work.
        batch,
      };
    });

    // Going cold: strong or good matches never emailed about anything and not touched in 30+ days.
    const byContact = new Map<string, { name: string; best: string; score: number; last: Date | null; everContacted: boolean }>();
    for (const p of out)
      for (const x of p.people) {
        if (x.score < GOOD) continue;
        const cur = byContact.get(x.contactId);
        const contacted = !!x.contactedAt || (cur?.everContacted ?? false);
        if (!cur || x.score > cur.score)
          byContact.set(x.contactId, { name: x.name, best: p.label, score: x.score, last: x.lastTouch, everContacted: contacted });
        else cur.everContacted = contacted;
      }
    const now = Date.now();
    const cold = [...byContact.entries()]
      .map(([contactId, v]) => ({
        contactId,
        name: v.name,
        best: v.best,
        days: v.last ? Math.floor((now - v.last.getTime()) / 86_400_000) : null,
        everContacted: v.everContacted,
      }))
      .filter((c) => !c.everContacted && (c.days === null || c.days >= 30))
      .sort((a, b) => (b.days ?? 9999) - (a.days ?? 9999))
      .slice(0, 8)
      .map(({ everContacted: _e, ...rest }) => (void _e, rest));

    out.sort((a, b) => b.counts.ready - a.counts.ready || b.counts.strong - a.counts.strong || b.people.length - a.people.length);
    return { properties: out, cold };
  });
}

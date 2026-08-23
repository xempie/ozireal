import { desc, eq, isNull, sql } from "drizzle-orm";
import { query } from "@/db";
import {
  contacts,
  contactIntent,
  interactions,
  listings,
  properties,
  suburbs,
  campaigns,
  campaignRecipients,
  approvalItems,
  confirmItems,
  mergeReviews,
  inspectionRegistrations,
  aiGenerations,
  blogPosts,
} from "@/db/schema";

/**
 * Analytics.
 *
 * Everything here is computed from real rows. Where the database genuinely cannot
 * answer a question yet, the function says so rather than returning a plausible shape -
 * see `hasHistory` at the bottom. A chart drawn from invented history is worse than an
 * empty chart, because nobody can tell it is wrong.
 */

export async function getContactsByIntent() {
  return query(async (tx) => {
    const rows = await tx
      .select({
        name: contactIntent.intentType,
        value: sql<number>`count(*)::int`,
      })
      .from(contactIntent)
      .groupBy(contactIntent.intentType);
    return rows
      .filter((r) => r.name)
      .map((r) => ({
        name: (r.name as string).charAt(0).toUpperCase() + (r.name as string).slice(1),
        value: r.value,
      }));
  });
}

export async function getContactsBySource() {
  return query(async (tx) => {
    const rows = await tx
      .select({
        source: contacts.sourceChannel,
        count: sql<number>`count(*)::int`,
      })
      .from(contacts)
      .where(isNull(contacts.tombstonedAt))
      .groupBy(contacts.sourceChannel)
      .orderBy(desc(sql`count(*)`));

    const label: Record<string, string> = {
      web_form: "Website forms",
      email: "Email",
      social: "Social",
      phone: "Phone",
      manual: "Walk-in",
      sms: "SMS",
      voice_note: "Voice note",
      portal: "Portal",
    };
    return rows.map((r) => ({ source: label[r.source] ?? r.source, count: r.count }));
  });
}

export async function getEnquiriesBySuburb() {
  return query(async (tx) => {
    const rows = await tx
      .select({
        suburb: suburbs.name,
        enquiries: sql<number>`count(*)::int`,
      })
      .from(interactions)
      .innerJoin(listings, eq(listings.id, interactions.listingId))
      .innerJoin(properties, eq(properties.id, listings.propertyId))
      .leftJoin(suburbs, eq(suburbs.id, properties.suburbId))
      .where(eq(interactions.direction, "in"))
      .groupBy(suburbs.name)
      .orderBy(desc(sql`count(*)`));
    return rows.filter((r) => r.suburb).map((r) => ({ suburb: r.suburb!, enquiries: r.enquiries }));
  });
}

/**
 * The pipeline.
 *
 * Every stage counts CONTACTS, and each is a strict subset of the one above. The first
 * version counted inbound interactions at stage one and contacts at stage two, which
 * are different populations - so the funnel could widen as it went down, and did:
 * 8 briefed from 6 enquiries. A funnel that grows is measuring two things.
 */
export async function getPipelineFunnel() {
  return query(async (tx) => {
    const [row] = await tx
      .select({
        enquired: sql<number>`count(*) filter (
          where exists (select 1 from interactions i
                        where i.contact_id = c.id and i.direction = 'in')
        )::int`,
        briefed: sql<number>`count(*) filter (
          where exists (select 1 from interactions i
                        where i.contact_id = c.id and i.direction = 'in')
            and exists (select 1 from contact_intent ci where ci.contact_id = c.id)
        )::int`,
        qualified: sql<number>`count(*) filter (
          where exists (select 1 from interactions i
                        where i.contact_id = c.id and i.direction = 'in')
            and exists (select 1 from contact_intent ci where ci.contact_id = c.id)
            and exists (select 1 from contact_preferences cp where cp.contact_id = c.id)
        )::int`,
        inspected: sql<number>`count(*) filter (
          where exists (select 1 from inspection_registrations r where r.contact_id = c.id)
        )::int`,
        offered: sql<number>`count(*) filter (
          where exists (
            select 1 from inspection_registrations r
            join inspections n on n.id = r.inspection_id
            join listings l on l.id = n.listing_id
            where r.contact_id = c.id and l.status in ('under_offer','sold','leased')
          )
        )::int`,
      })
      .from(sql`contacts c`)
      .where(sql`c.tombstoned_at is null`);

    const [openMerges] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(mergeReviews)
      .where(eq(mergeReviews.status, "open"));

    const stages = [
      { label: "Enquired", value: row.enquired, note: "contacts with an inbound touch" },
      {
        label: "Resolved and briefed",
        value: row.briefed,
        note: openMerges.n ? `${openMerges.n} still in merge review` : undefined,
      },
      { label: "Qualified - preferences captured", value: row.qualified },
      { label: "Inspected at least once", value: row.inspected },
      { label: "Offer or application made", value: row.offered },
    ];

    // A later stage can only ever be a subset. Clamp rather than render a funnel that
    // widens, which would be a visible lie about the data.
    let ceiling = Number.POSITIVE_INFINITY;
    return stages
      .map((s) => {
        const value = Math.min(s.value, ceiling);
        ceiling = value;
        return { ...s, value };
      })
      .filter((s) => s.value > 0);
  });
}

export async function getCampaignPerformance() {
  return query((tx) =>
    tx
      .select({
        name: campaigns.name,
        Sent: sql<number>`count(*) filter (where ${campaignRecipients.sentAt} is not null)::int`,
        Opened: sql<number>`count(*) filter (where ${campaignRecipients.openedAt} is not null)::int`,
        Replied: sql<number>`count(*) filter (where ${campaignRecipients.repliedAt} is not null)::int`,
      })
      .from(campaigns)
      .innerJoin(campaignRecipients, eq(campaignRecipients.campaignId, campaigns.id))
      .groupBy(campaigns.name)
      .orderBy(campaigns.name),
  );
}

export async function getApprovalThroughput() {
  return query(async (tx) => {
    const rows = await tx
      .select({
        status: approvalItems.status,
        n: sql<number>`count(*)::int`,
      })
      .from(approvalItems)
      .groupBy(approvalItems.status);
    const get = (s: string) => rows.find((r) => r.status === s)?.n ?? 0;
    return [
      {
        period: "To date",
        Approved: get("approved") + get("sent"),
        Pending: get("pending"),
        Rejected: get("rejected"),
        Blocked: get("blocked"),
      },
    ];
  });
}

export async function getAiSpendByModel() {
  return query((tx) =>
    tx
      .select({
        task: aiGenerations.task,
        Haiku: sql<number>`coalesce(sum(${aiGenerations.costAud}) filter (where ${aiGenerations.model} like '%haiku%'), 0)::float`,
        Sonnet: sql<number>`coalesce(sum(${aiGenerations.costAud}) filter (where ${aiGenerations.model} like '%sonnet%'), 0)::float`,
      })
      .from(aiGenerations)
      .groupBy(aiGenerations.task)
      .orderBy(aiGenerations.task),
  );
}

export async function getListingPerformance() {
  return query((tx) =>
    tx
      .select({
        address: sql<string>`trim(coalesce(${properties.streetNumber} || ' ', '') || coalesce(${properties.street}, '')) || ', ' || coalesce(${suburbs.name}, '')`,
        status: listings.status,
        priceDisplay: listings.priceDisplay,
        views7d: listings.views7d,
        enquiries7d: listings.enquiries7d,
        photos: sql<number>`(select count(*)::int from listing_media m where m.listing_id = ${listings.id} and m.kind = 'photo')`,
      })
      .from(listings)
      .innerJoin(properties, eq(properties.id, listings.propertyId))
      .leftJoin(suburbs, eq(suburbs.id, properties.suburbId))
      .where(sql`${listings.views7d} > 0`)
      .orderBy(desc(listings.views7d)),
  );
}

export async function getContentTotals() {
  return query(async (tx) => {
    const [row] = await tx
      .select({
        published: sql<number>`count(*) filter (where ${blogPosts.status} = 'published')::int`,
        legacy: sql<number>`count(*) filter (where ${blogPosts.legacyUrl} is not null)::int`,
        views: sql<number>`coalesce(sum(${blogPosts.views30d}), 0)::int`,
      })
      .from(blogPosts);
    return row;
  });
}

/**
 * Whether the database holds enough history for a time series.
 *
 * The seed carries current state, not months of it, so a weekly trend would be one
 * bucket with everything in it and eight empty ones. Screens call this and show an
 * honest "not enough history yet" panel rather than a chart implying a trend that has
 * not been observed. It starts returning true on its own as real data accumulates.
 */
export async function hasHistory(weeks = 4) {
  return query(async (tx) => {
    const [row] = await tx
      .select({
        span: sql<number>`coalesce(extract(day from (max(${interactions.occurredAt}) - min(${interactions.occurredAt}))), 0)::int`,
      })
      .from(interactions);
    return (row?.span ?? 0) >= weeks * 7;
  });
}

/** Weekly inbound volume by channel. Empty until there is history to bucket. */
export async function getEnquiryTrend() {
  if (!(await hasHistory())) return [];
  return query((tx) =>
    tx
      .select({
        week: sql<string>`to_char(date_trunc('week', ${interactions.occurredAt}), 'DD Mon')`,
        Web: sql<number>`count(*) filter (where ${interactions.channel} = 'web_form')::int`,
        Email: sql<number>`count(*) filter (where ${interactions.channel} = 'email')::int`,
        Social: sql<number>`count(*) filter (where ${interactions.channel} = 'social')::int`,
        Phone: sql<number>`count(*) filter (where ${interactions.channel} = 'phone')::int`,
      })
      .from(interactions)
      .where(eq(interactions.direction, "in"))
      .groupBy(sql`date_trunc('week', ${interactions.occurredAt})`)
      .orderBy(sql`date_trunc('week', ${interactions.occurredAt})`),
  );
}

import { and, desc, eq, isNotNull, isNull, ne, sql, inArray } from "drizzle-orm";
import { query } from "@/db";
import {
  tenants,
  users,
  contacts,
  approvalItems,
  campaigns,
  campaignRecipients,
  proposals,
  tasks,
  calendarEvents,
  voiceNotes,
  blogPosts,
  socialPosts,
  seoIssues,
  redirects,
  suburbPages,
  aiGenerations,
  auditLog,
  channelAdapters,
  savedViews,
  consentTemplates,
  disclosureRules,
  listings,
  properties,
  suburbs,
  consents,
  contactIntent,
  interactions,
  confirmItems,
  mergeReviews,
} from "@/db/schema";

const addressSql = sql<string>`
  trim(coalesce(${properties.streetNumber} || ' ', '') || coalesce(${properties.street}, ''))
  || ', ' || coalesce(${suburbs.name}, '')`;

/* ------------------------------------------------------------- the agency */

export async function getAgency() {
  return query(async (tx) => {
    const [t] = await tx.select().from(tenants).limit(1);
    const [u] = await tx.select().from(users).limit(1);
    return {
      name: t.name,
      tradingName: t.tradingName,
      licence: t.licenceNumber,
      abn: t.abn,
      jurisdiction: t.jurisdiction === "SA" ? "South Australia" : t.jurisdiction,
      timezone: t.timezone,
      user: { name: u?.name ?? "", email: u?.email ?? "", role: "Principal" },
    };
  });
}

/* ------------------------------------------------------- approval queue */

export async function getApprovals() {
  return query(async (tx) => {
    const rows = await tx
      .select({
        id: approvalItems.id,
        kind: approvalItems.kind,
        status: approvalItems.status,
        contactId: approvalItems.contactId,
        contactName: sql<string | null>`${contacts.firstName} || ' ' || ${contacts.lastName}`,
        listingId: approvalItems.listingId,
        address: addressSql,
        subject: approvalItems.draftSubject,
        body: approvalItems.draftBody,
        createdAt: approvalItems.createdAt,
        consentAtDraft: approvalItems.consentAtDraft,
        blockReason: approvalItems.blockReason,
        rejectReason: approvalItems.rejectReason,
        reviewedBy: users.name,
        reviewedAt: approvalItems.reviewedAt,
        model: approvalItems.model,
        costAud: approvalItems.costAud,
      })
      .from(approvalItems)
      .leftJoin(contacts, eq(contacts.id, approvalItems.contactId))
      .leftJoin(listings, eq(listings.id, approvalItems.listingId))
      .leftJoin(properties, eq(properties.id, listings.propertyId))
      .leftJoin(suburbs, eq(suburbs.id, properties.suburbId))
      .leftJoin(users, eq(users.id, approvalItems.reviewedByUserId))
      .orderBy(desc(approvalItems.createdAt));

    /**
     * Consent as it stands NOW, not as recorded on the draft. Rule 2: the check that
     * matters happens at send time, so the screen has to show the live value or the
     * "changed since drafting" badge would be decorative.
     */
    const live = await tx
      .select({
        contactId: consents.contactId,
        channel: consents.channel,
        status: consents.status,
        occurredAt: consents.occurredAt,
      })
      .from(consents)
      .orderBy(consents.occurredAt);

    const currentFor = (contactId: string | null, kind: string) => {
      if (!contactId) return null;
      const channel = kind === "sms" ? "sms" : "email";
      const rows = live.filter(
        (k) => k.contactId === contactId && k.channel === channel,
      );
      return rows.length ? rows[rows.length - 1].status : "never_given";
    };

    return rows.map((a) => ({
      ...a,
      costAud: a.costAud ? Number(a.costAud) : 0,
      consentNow: currentFor(a.contactId, a.kind),
    }));
  });
}

/* ---------------------------------------------------------------- counts */

export async function getCounts() {
  return query(async (tx) => {
    const one = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n ?? 0;
    const c = (table: Parameters<typeof tx.select>[0] extends never ? never : never) => c;
    void c;

    const [approvalsN] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(approvalItems)
      .where(eq(approvalItems.status, "pending"));
    const [blockedN] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(approvalItems)
      .where(eq(approvalItems.status, "blocked"));
    const [confirmsN] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(confirmItems)
      .where(eq(confirmItems.status, "pending"));
    const [mergesN] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(mergeReviews)
      .where(eq(mergeReviews.status, "open"));
    const [contactsN] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(contacts)
      .where(isNull(contacts.tombstonedAt));
    const [liveN] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(listings)
      .where(eq(listings.status, "live"));
    const [tasksN] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(tasks)
      .where(eq(tasks.status, "open"));
    void one;

    return {
      approvals: approvalsN.n,
      blocked: blockedN.n,
      confirms: confirmsN.n,
      merges: mergesN.n,
      contacts: contactsN.n,
      liveListings: liveN.n,
      tasksOpen: tasksN.n,
    };
  });
}

/**
 * The four home tiles' numbers, in one round trip. Each is a count the tile's page
 * would show at the top, so the tile never promises something the page contradicts.
 */
export async function getHomeCounts() {
  return query(async (tx) => {
    const [row] = await tx.execute<{
      contacts: number;
      followups_due: number;
      properties: number;
      listed: number;
      off_market: number;
      tasks_open: number;
      tasks_overdue: number;
      approvals: number;
      confirms: number;
    }>(sql`
      select
        (select count(*)::int from ${contacts}
           where ${contacts.tombstonedAt} is null) as contacts,
        (select count(*)::int from ${contacts}
           where ${contacts.tombstonedAt} is null
             and ${contacts.followupDueAt} <= now()) as followups_due,
        (select count(*)::int from ${properties}
           where ${properties.status} <> 'archived') as properties,
        (select count(distinct ${listings.propertyId})::int from ${listings}
           where ${listings.status} in ('live', 'under_offer')) as listed,
        (select count(*)::int from ${properties}
           where ${properties.status} = 'off_market') as off_market,
        (select count(*)::int from ${tasks} where ${tasks.status} = 'open') as tasks_open,
        (select count(*)::int from ${tasks}
           where ${tasks.status} = 'open' and ${tasks.dueAt} < now()) as tasks_overdue,
        (select count(*)::int from ${approvalItems}
           where ${approvalItems.status} = 'pending') as approvals,
        (select count(*)::int from ${confirmItems}
           where ${confirmItems.status} = 'pending') as confirms
    `);
    return {
      contacts: row?.contacts ?? 0,
      followupsDue: row?.followups_due ?? 0,
      properties: row?.properties ?? 0,
      listed: row?.listed ?? 0,
      offMarket: row?.off_market ?? 0,
      tasksOpen: row?.tasks_open ?? 0,
      tasksOverdue: row?.tasks_overdue ?? 0,
      approvals: row?.approvals ?? 0,
      confirms: row?.confirms ?? 0,
    };
  });
}

/* ------------------------------------------------------------- campaigns */

export async function getCampaigns() {
  return query((tx) =>
    tx
      .select({
        id: campaigns.id,
        name: campaigns.name,
        listingId: campaigns.listingId,
        address: addressSql,
        channel: campaigns.channel,
        status: campaigns.status,
        createdAt: campaigns.createdAt,
        sentAt: campaigns.sentAt,
        // Counts over real recipient rows, so they cannot drift from what happened.
        recipients: sql<number>`(select count(*)::int from ${campaignRecipients} r where r.campaign_id = ${campaigns.id})`,
        approved: sql<number>`(select count(*)::int from ${campaignRecipients} r where r.campaign_id = ${campaigns.id} and r.sent_at is not null)`,
        blocked: sql<number>`(select count(*)::int from ${campaignRecipients} r where r.campaign_id = ${campaigns.id} and r.blocked_reason is not null)`,
        opened: sql<number>`(select count(*)::int from ${campaignRecipients} r where r.campaign_id = ${campaigns.id} and r.opened_at is not null)`,
        replied: sql<number>`(select count(*)::int from ${campaignRecipients} r where r.campaign_id = ${campaigns.id} and r.replied_at is not null)`,
      })
      .from(campaigns)
      .leftJoin(listings, eq(listings.id, campaigns.listingId))
      .leftJoin(properties, eq(properties.id, listings.propertyId))
      .leftJoin(suburbs, eq(suburbs.id, properties.suburbId))
      .orderBy(desc(campaigns.createdAt)),
  );
}

/* -------------------------------------------------------- assistant layer */

export async function getTasks() {
  return query((tx) =>
    tx
      .select({
        id: tasks.id,
        contactId: tasks.contactId,
        contactName: sql<string | null>`${contacts.firstName} || ' ' || ${contacts.lastName}`,
        listingId: tasks.listingId,
        title: tasks.title,
        dueAt: tasks.dueAt,
        done: sql<boolean>`${tasks.status} = 'done'`,
        source: tasks.sourceLabel,
      })
      .from(tasks)
      .leftJoin(contacts, eq(contacts.id, tasks.contactId))
      .orderBy(tasks.dueAt),
  );
}

export async function getCalendarEvents() {
  return query((tx) =>
    tx
      .select({
        id: calendarEvents.id,
        title: calendarEvents.title,
        startsAt: calendarEvents.startsAt,
        endsAt: calendarEvents.endsAt,
        kind: calendarEvents.kind,
        provider: calendarEvents.provider,
        ourWrite: calendarEvents.ourWrite,
        contactId: calendarEvents.contactId,
        contactName: sql<string | null>`${contacts.firstName} || ' ' || ${contacts.lastName}`,
        listingId: calendarEvents.listingId,
        address: addressSql,
      })
      .from(calendarEvents)
      .leftJoin(contacts, eq(contacts.id, calendarEvents.contactId))
      .leftJoin(listings, eq(listings.id, calendarEvents.listingId))
      .leftJoin(properties, eq(properties.id, listings.propertyId))
      .leftJoin(suburbs, eq(suburbs.id, properties.suburbId))
      /**
       * A cancelled event is not on the calendar. The row survives so the two-way
       * sync (D5) has something to push when it lands - a locally deleted row is
       * indistinguishable from one that never synced, and the remote copy would
       * then live forever.
       */
      .where(isNull(calendarEvents.cancelledAt))
      .orderBy(calendarEvents.startsAt),
  );
}

export async function getVoiceNotes() {
  return query(async (tx) => {
    const rows = await tx
      .select({
        id: voiceNotes.id,
        recordedAt: voiceNotes.recordedAt,
        seconds: voiceNotes.durationSeconds,
        contactId: voiceNotes.contactId,
        contactName: sql<string | null>`${contacts.firstName} || ' ' || ${contacts.lastName}`,
        transcript: voiceNotes.transcript,
        status: voiceNotes.status,
      })
      .from(voiceNotes)
      .leftJoin(contacts, eq(contacts.id, voiceNotes.contactId))
      .orderBy(desc(voiceNotes.recordedAt));

    const extracted = await tx
      .select({
        voiceNoteId: confirmItems.sourceVoiceNoteId,
        summary: confirmItems.summary,
      })
      .from(confirmItems)
      .where(isNotNull(confirmItems.sourceVoiceNoteId));

    return rows.map((v) => ({
      ...v,
      seconds: v.seconds ?? 0,
      extracted: extracted.filter((e) => e.voiceNoteId === v.id).map((e) => e.summary),
    }));
  });
}

export async function getProposals() {
  return query((tx) =>
    tx
      .select({
        id: proposals.id,
        propertyId: proposals.propertyId,
        address: sql<string>`trim(coalesce(${properties.streetNumber} || ' ', '') || coalesce(${properties.street}, ''))`,
        suburb: suburbs.name,
        contactId: proposals.contactId,
        contactName: sql<string>`${contacts.firstName} || ' ' || ${contacts.lastName}`,
        status: proposals.status,
        estimateLow: proposals.estimateLow,
        estimateHigh: proposals.estimateHigh,
        comparables: proposals.comparables,
        pages: proposals.pages,
        createdAt: proposals.createdAt,
      })
      .from(proposals)
      .leftJoin(properties, eq(properties.id, proposals.propertyId))
      .leftJoin(suburbs, eq(suburbs.id, properties.suburbId))
      .innerJoin(contacts, eq(contacts.id, proposals.contactId))
      .orderBy(desc(proposals.createdAt)),
  );
}

/* ---------------------------------------------------------- content & site */

export async function getBlogPosts() {
  return query((tx) =>
    tx
      .select({
        id: blogPosts.id,
        title: blogPosts.title,
        slug: blogPosts.slug,
        status: blogPosts.status,
        body: blogPosts.body,
        words: blogPosts.wordCount,
        createdAt: blogPosts.createdAt,
        publishedAt: blogPosts.publishedAt,
        views30d: blogPosts.views30d,
        legacy: sql<boolean>`${blogPosts.legacyUrl} is not null`,
      })
      .from(blogPosts)
      .orderBy(desc(blogPosts.createdAt)),
  );
}

export async function getSocialPosts() {
  return query((tx) =>
    tx
      .select({
        id: socialPosts.id,
        network: socialPosts.network,
        status: socialPosts.status,
        body: socialPosts.body,
        listingId: socialPosts.listingId,
        address: addressSql,
        engagement: socialPosts.engagement,
        createdAt: socialPosts.createdAt,
      })
      .from(socialPosts)
      .leftJoin(listings, eq(listings.id, socialPosts.listingId))
      .leftJoin(properties, eq(properties.id, listings.propertyId))
      .leftJoin(suburbs, eq(suburbs.id, properties.suburbId))
      .orderBy(desc(socialPosts.createdAt)),
  );
}

export async function getSeoIssues() {
  return query((tx) =>
    tx
      .select({
        id: seoIssues.id,
        severity: seoIssues.severity,
        title: seoIssues.title,
        detail: seoIssues.detail,
        proposal: seoIssues.proposal,
        affected: seoIssues.affectedCount,
        status: seoIssues.status,
      })
      .from(seoIssues)
      /**
       * Everything except what has been actioned and applied. Accepted and
       * dismissed findings stay visible so a decision can be taken back - a
       * dismissal that vanishes on click is indistinguishable from one that
       * failed.
       */
      .where(ne(seoIssues.status, "resolved"))
      .orderBy(seoIssues.severity),
  );
}

export async function getRedirects() {
  return query((tx) =>
    tx
      .select({
        id: redirects.id,
        from: redirects.fromPath,
        to: redirects.toPath,
        status: redirects.status,
        note: redirects.note,
      })
      .from(redirects)
      .orderBy(redirects.fromPath),
  );
}

export async function getSuburbPages() {
  return query(async (tx) => {
    const pages = await tx.select().from(suburbPages).orderBy(suburbPages.suburbName);
    const counts = await tx
      .select({
        suburb: suburbs.name,
        live: sql<number>`count(*) filter (where ${listings.status} = 'live')::int`,
        sold: sql<number>`count(*) filter (where ${listings.status} = 'sold')::int`,
      })
      .from(listings)
      .innerJoin(properties, eq(properties.id, listings.propertyId))
      .leftJoin(suburbs, eq(suburbs.id, properties.suburbId))
      .groupBy(suburbs.name);

    return pages.map((p) => {
      const c = counts.find((x) => x.suburb === p.suburbName);
      return {
        suburb: p.suburbName,
        live: c?.live ?? 0,
        sold: c?.sold ?? 0,
        words: p.marketCopy?.split(/\s+/).length ?? 0,
        status: p.status === "draft" ? "not built" : p.status,
      };
    });
  });
}

/* ------------------------------------------------------------------ ops */

export async function getAiCostSummary() {
  return query(async (tx) => {
    const byTask = await tx
      .select({
        task: aiGenerations.task,
        model: sql<string>`case when ${aiGenerations.model} like '%sonnet%' then 'Sonnet' else 'Haiku' end`,
        calls: sql<number>`count(*)::int`,
        inputTokens: sql<number>`sum(${aiGenerations.inputTokens})::int`,
        outputTokens: sql<number>`sum(${aiGenerations.outputTokens})::int`,
        costAud: sql<number>`sum(${aiGenerations.costAud})::float`,
        avgLatencyMs: sql<number>`avg(${aiGenerations.latencyMs})::int`,
      })
      .from(aiGenerations)
      .groupBy(aiGenerations.task, sql`2`)
      .orderBy(desc(sql`sum(${aiGenerations.costAud})`));

    const [totals] = await tx
      .select({
        month: sql<number>`sum(${aiGenerations.costAud})::float`,
        today: sql<number>`coalesce(sum(${aiGenerations.costAud}) filter (where ${aiGenerations.createdAt} >= current_date), 0)::float`,
      })
      .from(aiGenerations);

    const byDay = await tx
      .select({
        day: sql<string>`to_char(${aiGenerations.createdAt}, 'Dy')`,
        aud: sql<number>`sum(${aiGenerations.costAud})::float`,
      })
      .from(aiGenerations)
      .groupBy(sql`1`, sql`date_trunc('day', ${aiGenerations.createdAt})`)
      .orderBy(sql`date_trunc('day', ${aiGenerations.createdAt})`);

    return { byTask, byDay, totalMonth: totals?.month ?? 0, today: totals?.today ?? 0 };
  });
}

export async function getAuditLog(limit = 20) {
  return query((tx) =>
    tx
      .select({
        id: auditLog.id,
        at: auditLog.occurredAt,
        actor: auditLog.actorLabel,
        action: auditLog.action,
        target: auditLog.target,
        kind: auditLog.kind,
      })
      .from(auditLog)
      .orderBy(desc(auditLog.occurredAt))
      .limit(limit),
  );
}

export async function getAdapters() {
  return query((tx) =>
    tx
      .select({
        name: channelAdapters.name,
        status: channelAdapters.status,
        lastReceived: channelAdapters.lastReceivedAt,
        today: channelAdapters.receivedToday,
      })
      .from(channelAdapters)
      .orderBy(channelAdapters.name),
  );
}

export async function getSavedViews() {
  return query((tx) =>
    tx
      .select({
        id: savedViews.id,
        name: savedViews.name,
        detail: savedViews.description,
      })
      .from(savedViews)
      .orderBy(savedViews.name),
  );
}

export async function getSettings() {
  return query(async (tx) => {
    const templates = await tx
      .select({ form: consentTemplates.formName, wording: consentTemplates.wording })
      .from(consentTemplates)
      .orderBy(consentTemplates.formName);
    const rules = await tx
      .select({
        name: disclosureRules.name,
        detail: disclosureRules.detail,
        state: disclosureRules.jurisdiction,
      })
      .from(disclosureRules)
      .orderBy(disclosureRules.name);
    return { templates, rules };
  });
}

/**
 * BullMQ owns the real queue; until B3 wires it up there is nothing to read. Returning
 * an empty list is the honest answer - inventing counts would make a broken worker look
 * healthy, which is the one thing this panel exists to prevent.
 */
export async function getJobQueue() {
  return [] as {
    name: string;
    pending: number;
    active: number;
    failed: number;
    dead: number;
  }[];
}

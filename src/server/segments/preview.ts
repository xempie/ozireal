import { sql } from "drizzle-orm";
import { query, type Tx } from "@/db";
import {
  SEGMENT_FROM,
  andAll,
  contactability,
  contactablePredicates,
  criteriaPredicates,
} from "./predicate";
import type { SegmentFilter } from "./schema";

/**
 * Previewing a segment.
 *
 * The number that matters here is not "38 people match". It is "38 match, and 6 more
 * would have except that four never gave SMS consent and two have no mobile on file".
 * The first number lets an agent press send; only the second lets them notice that
 * their best twenty contacts are missing because nobody ever ticked the box.
 *
 * So the preview runs the criteria and the contactability rules as SEPARATE
 * conditions, and reports the gap between them by cause. Everything is one query —
 * a count per reason would be five round trips and could disagree with itself if a
 * consent row landed between them.
 */

export type ExclusionBreakdown = {
  noConsent: number;
  noMobile: number;
  doNotContact: number;
  /** Tombstoned or merged away. Never re-includable — shown so the total adds up. */
  notLive: number;
};

export type SegmentPreview = {
  /** Contacts who match the criteria AND can be messaged. The audience. */
  eligible: number;
  /** Matched the criteria but cannot be messaged, by cause. */
  excluded: ExclusionBreakdown;
  excludedTotal: number;
  /** Everyone matching the criteria, sendable or not. */
  matchedCriteria: number;
  sample: SegmentContact[];
};

export type SegmentContact = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  suburb: string | null;
  intentType: string | null;
  sentiment: string | null;
  budgetBand: string | null;
  priceMin: number | null;
  priceMax: number | null;
  bedsMin: number | null;
  timeline: string | null;
  financeStatus: string | null;
  softRequirements: string | null;
  rollingBrief: string | null;
  lastFollowupOutcome: string | null;
  lastTouchedAt: Date | null;
  /** Present only when the segment is anchored to a listing. */
  matchScore: number | null;
  matchReason: string | null;
};

/** How many rows the preview list shows. The counts are over the whole segment. */
const SAMPLE_LIMIT = 500;

/**
 * The listing anchor.
 *
 * The matcher is not observable from outside — `matchContactsForListing` returns
 * counts and writes `matches`, so the only way to use its shortlist is to read the
 * table back. `getMatchesForListing` cannot be used for this: it returns no
 * `phone_e164`, no consent and no tombstone filter, and `matches` rows persist after
 * a contact is later marked do-not-contact, so a send built on it would happily
 * include people it must not.
 */
function anchorPredicate(listingId: string) {
  return sql`
    exists (
      select 1 from matches mt
      where mt.contact_id = c.id and mt.listing_id = ${listingId}
    )
  `;
}

function buildWhere(f: SegmentFilter) {
  const criteria = criteriaPredicates(f);
  if (f.listingId) criteria.push(anchorPredicate(f.listingId));
  return {
    criteria: andAll(criteria),
    contactable: andAll(contactablePredicates()),
  };
}

/**
 * Counts and a sample, in two statements inside one transaction.
 *
 * Split because the counts must cover the whole segment while the sample is capped —
 * a 4,000-contact segment should still report 4,000 rather than 500. One transaction
 * so the two cannot disagree.
 */
export async function previewSegment(f: SegmentFilter): Promise<SegmentPreview> {
  return query((tx) => previewSegmentIn(tx, f));
}

/** The same thing against a caller's transaction, for actions and jobs. */
export async function previewSegmentIn(
  tx: Tx,
  f: SegmentFilter,
): Promise<SegmentPreview> {
  const { criteria, contactable } = buildWhere(f);

  /**
   * `filter (where ...)` rather than four subqueries: one pass over the same rows, so
   * the parts are guaranteed to sum to the whole. The exclusion reasons deliberately
   * OVERLAP — someone can have no mobile AND no consent — so they are counted
   * independently and `excludedTotal` is its own expression rather than their sum.
   * Presenting overlapping causes as if they partitioned would produce a breakdown
   * that adds up to more than the total and quietly discredits the whole panel.
   */
  const counts = await tx.execute<{
    matched: number;
    eligible: number;
    excluded: number;
    no_consent: number;
    no_mobile: number;
    dnc: number;
    not_live: number;
  }>(sql`
    select
      count(*)::int as matched,
      count(*) filter (where ${contactable})::int as eligible,
      count(*) filter (where not (${contactable}))::int as excluded,
      count(*) filter (where not (${contactability.smsConsent}))::int as no_consent,
      count(*) filter (where not (${contactability.hasMobile}))::int as no_mobile,
      count(*) filter (where not (${contactability.notDnc}))::int as dnc,
      count(*) filter (where not (${contactability.live}))::int as not_live
    ${SEGMENT_FROM}
    where ${criteria}
  `);

  const c = counts[0] ?? {
    matched: 0,
    eligible: 0,
    excluded: 0,
    no_consent: 0,
    no_mobile: 0,
    dnc: 0,
    not_live: 0,
  };

  const sample = await tx.execute<SegmentContactRow>(sql`
    select
      c.id, c.first_name, c.last_name, c.phone_e164, c.suburb,
      c.last_followup_outcome,
      ci.intent_type, ci.sentiment, ci.budget_band, ci.rolling_brief,
      cp.price_min, cp.price_max, cp.beds_min, cp.soft_requirements,
      coalesce(cp.timeline, ci.timeline) as timeline,
      cp.finance_status,
      (select max(i.occurred_at) from interactions i
        where i.contact_id = c.id and i.tombstoned_at is null) as last_touched_at,
      ${
        f.listingId
          ? sql`(select mt.score from matches mt
                  where mt.contact_id = c.id and mt.listing_id = ${f.listingId})`
          : sql`null::real`
      } as match_score,
      ${
        f.listingId
          ? sql`(select mt.reason from matches mt
                  where mt.contact_id = c.id and mt.listing_id = ${f.listingId})`
          : sql`null::text`
      } as match_reason
    ${SEGMENT_FROM}
    where ${criteria} and ${contactable}
    -- Best match first when anchored, so the sample shows the strongest cases; by
    -- name otherwise, because an arbitrary order in a review list is unreadable.
    order by match_score desc nulls last, c.first_name, c.last_name
    limit ${SAMPLE_LIMIT}
  `);

  return {
    eligible: c.eligible,
    matchedCriteria: c.matched,
    excludedTotal: c.excluded,
    excluded: {
      noConsent: c.no_consent,
      noMobile: c.no_mobile,
      doNotContact: c.dnc,
      notLive: c.not_live,
    },
    sample: sample.map(toContact),
  };
}

/**
 * The audience itself — every eligible contact, not a sample.
 *
 * Used when a campaign is actually created. Capped, because a personalised draft is a
 * paid model call per recipient and an unbounded segment is an unbounded bill; the
 * caller reports the cap rather than silently truncating.
 */
export const AUDIENCE_CAP = 500;

export async function segmentAudience(
  tx: Tx,
  f: SegmentFilter,
): Promise<SegmentContact[]> {
  const { criteria, contactable } = buildWhere(f);
  const rows = await tx.execute<SegmentContactRow>(sql`
    select
      c.id, c.first_name, c.last_name, c.phone_e164, c.suburb,
      c.last_followup_outcome,
      ci.intent_type, ci.sentiment, ci.budget_band, ci.rolling_brief,
      cp.price_min, cp.price_max, cp.beds_min, cp.soft_requirements,
      coalesce(cp.timeline, ci.timeline) as timeline,
      cp.finance_status,
      (select max(i.occurred_at) from interactions i
        where i.contact_id = c.id and i.tombstoned_at is null) as last_touched_at,
      ${
        f.listingId
          ? sql`(select mt.score from matches mt
                  where mt.contact_id = c.id and mt.listing_id = ${f.listingId})`
          : sql`null::real`
      } as match_score,
      ${
        f.listingId
          ? sql`(select mt.reason from matches mt
                  where mt.contact_id = c.id and mt.listing_id = ${f.listingId})`
          : sql`null::text`
      } as match_reason
    ${SEGMENT_FROM}
    where ${criteria} and ${contactable}
    order by match_score desc nulls last, c.first_name, c.last_name
    limit ${AUDIENCE_CAP}
  `);
  return rows.map(toContact);
}

type SegmentContactRow = {
  id: string;
  first_name: string;
  last_name: string;
  phone_e164: string | null;
  suburb: string | null;
  last_followup_outcome: string | null;
  intent_type: string | null;
  sentiment: string | null;
  budget_band: string | null;
  rolling_brief: string | null;
  price_min: number | null;
  price_max: number | null;
  beds_min: number | null;
  soft_requirements: string | null;
  timeline: string | null;
  finance_status: string | null;
  last_touched_at: Date | string | null;
  match_score: number | null;
  match_reason: string | null;
};

function toContact(r: SegmentContactRow): SegmentContact {
  return {
    id: r.id,
    firstName: r.first_name,
    lastName: r.last_name,
    phone: r.phone_e164,
    suburb: r.suburb,
    intentType: r.intent_type,
    sentiment: r.sentiment,
    budgetBand: r.budget_band,
    priceMin: r.price_min,
    priceMax: r.price_max,
    bedsMin: r.beds_min,
    timeline: r.timeline,
    financeStatus: r.finance_status,
    softRequirements: r.soft_requirements,
    rollingBrief: r.rolling_brief,
    lastFollowupOutcome: r.last_followup_outcome,
    // `tx.execute` returns whatever the driver gives it; a timestamptz arrives as a
    // Date, but a null must stay null rather than becoming 1970.
    lastTouchedAt: r.last_touched_at ? new Date(r.last_touched_at) : null,
    matchScore: r.match_score,
    matchReason: r.match_reason,
  };
}

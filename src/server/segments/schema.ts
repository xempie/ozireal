import { z } from "zod";

/**
 * A segment: the question "who should hear about this?", written down.
 *
 * This is the schema for two jsonb columns that already existed and had no reader —
 * `saved_views.filter` (which the seed filled with a placeholder `{note: "..."}` and
 * the console rendered as dashed, unclickable chips) and `campaigns.segment`, added
 * in migration 0013 so a campaign records the question that produced its recipients.
 *
 * Every field is optional. An empty segment means "everyone contactable", which is a
 * real and occasionally correct answer — and the preview shows the count, so nobody
 * reaches that state without seeing it first.
 *
 * ## Why this is not the matcher's filter
 *
 * `src/server/matching/engine.ts` stage 1 asks: *would this person tolerate this
 * house?* There, a null on the contact side means "they have not constrained this",
 * so a null budget must NOT exclude — the comment at engine.ts:126 is explicit about
 * it.
 *
 * A segment asks the opposite: *whose budget reaches 800k?* A contact with no stated
 * budget is **unknown, not yes**. Answering "yes" is how a campaign aimed at
 * pre-approved buyers in the 700s goes to every browser who ever filled in a form.
 *
 * So a positive criterion here excludes nulls, `includeUnknowns` brings them back
 * deliberately, and the preview reports both numbers. The two modules disagree on
 * purpose and each is right about its own question.
 */

export const PROPERTY_TYPES = [
  "house",
  "unit",
  "townhouse",
  "land",
  "acreage",
  "commercial",
] as const;

export const CONTACT_ROLES = [
  "buyer",
  "vendor",
  "landlord",
  "tenant",
  "referrer",
  "investor",
  "business_vendor",
] as const;

export const INTENT_TYPES = [
  "buying",
  "selling",
  "renting",
  "investing",
  "browsing",
] as const;

export const SENTIMENTS = ["hot", "warm", "neutral", "cooling"] as const;

/** An empty multi-select submits nothing; treat that as "no constraint", not "none of them". */
const optionalEnumList = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .array(z.enum(values))
    .max(values.length)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined));

const optionalUuidList = z
  .array(z.string().uuid())
  .max(200)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

/**
 * Free-text criteria.
 *
 * `timeline`, `finance_status` and `budget_band` have no pgEnum — they are text
 * columns holding whatever the extraction wrote ("Pre-approved", "Within 3 months",
 * "Finance not started"). The UI offers the distinct values actually present rather
 * than a made-up list, so this is an exact-match IN, never a LIKE: a fuzzy match on
 * "not started" would silently also catch "started".
 */
const optionalTextList = z
  .array(z.string().trim().min(1).max(120))
  .max(40)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

const optionalPositiveInt = z.preprocess(
  // An empty number input submits "", and z.coerce.number() turns "" into 0 —
  // which would read as a real constraint of zero rather than "not set".
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.coerce.number().int().min(0).max(50_000_000).optional(),
);

export const segmentFilter = z.object({
  /**
   * Anchor to a listing.
   *
   * When set, the audience starts from that listing's ranked matches (§6) instead of
   * the whole contact list, and each match's written reason becomes material for the
   * personalised draft. The attribute criteria below still apply on top.
   */
  listingId: z.union([z.string().uuid(), z.literal("")]).optional(),

  /**
   * Where they want to buy — `contact_preference_suburbs`, a real FK.
   *
   * Deliberately distinct from `livesInSuburb` below, which is `contacts.suburb`,
   * free text, and answers "where do they live now". Conflating the two is how a
   * campaign for Norwood buyers goes to everyone who happens to live in Norwood.
   */
  wantsSuburbIds: optionalUuidList,
  livesInSuburb: z.string().trim().max(80).optional(),

  /** Their budget must reach at least this. Excludes unstated budgets by default. */
  budgetAtLeast: optionalPositiveInt,
  /** Their budget must not start above this. */
  budgetAtMost: optionalPositiveInt,
  rentAtLeastPw: optionalPositiveInt,
  bedsAtLeast: optionalPositiveInt,
  bathsAtLeast: optionalPositiveInt,
  parkingAtLeast: optionalPositiveInt,

  propertyTypes: optionalEnumList(PROPERTY_TYPES),
  roles: optionalEnumList(CONTACT_ROLES),
  /**
   * `contact_roles` carries `active_from` / `active_to` so a role can lapse without
   * the history being lost — and nothing in the codebase has ever consulted them.
   * Default is current roles only; a lapsed vendor is not someone to pitch as a
   * vendor today.
   */
  includeLapsedRoles: z.coerce.boolean().optional().default(false),

  intentTypes: optionalEnumList(INTENT_TYPES),
  sentiments: optionalEnumList(SENTIMENTS),
  timelineAny: optionalTextList,
  financeStatusAny: optionalTextList,

  /** Leave people alone who were contacted recently. */
  notContactedWithinDays: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce.number().int().min(1).max(3650).optional(),
  ),
  /** Suppression: never send twice from two campaigns in one week. */
  excludeCampaignIds: optionalUuidList,

  /**
   * Count a missing value as a match.
   *
   * Off by default — see the header. Turning it on is a deliberate "and anyone we
   * simply have not asked yet", which is sometimes exactly right for a soft
   * market-update message and almost never right for a targeted one.
   */
  includeUnknowns: z.coerce.boolean().optional().default(false),
});

export type SegmentFilter = z.infer<typeof segmentFilter>;

/**
 * Parse a filter that came out of a jsonb column.
 *
 * Stored filters are older than the code reading them — a saved view written last
 * month may predate a field, and the seed's placeholder `{note: "..."}` is not a
 * filter at all. Unknown keys are dropped by Zod and a total failure degrades to the
 * empty segment rather than throwing, because a broken saved view should render as
 * "no criteria" and be fixable, not take the page down.
 */
export function parseStoredFilter(raw: unknown): SegmentFilter {
  const parsed = segmentFilter.safeParse(raw ?? {});
  return parsed.success ? parsed.data : segmentFilter.parse({});
}

/** True when nothing has been narrowed — i.e. "everyone contactable". */
export function isEmptySegment(f: SegmentFilter): boolean {
  return !(
    f.listingId ||
    f.wantsSuburbIds ||
    f.livesInSuburb ||
    f.budgetAtLeast !== undefined ||
    f.budgetAtMost !== undefined ||
    f.rentAtLeastPw !== undefined ||
    f.bedsAtLeast !== undefined ||
    f.bathsAtLeast !== undefined ||
    f.parkingAtLeast !== undefined ||
    f.propertyTypes ||
    f.roles ||
    f.intentTypes ||
    f.sentiments ||
    f.timelineAny ||
    f.financeStatusAny ||
    f.notContactedWithinDays !== undefined ||
    f.excludeCampaignIds
  );
}

/**
 * A human sentence describing the segment, for the campaign screen and the audit
 * trail. Reading back what a filter asked for is how a person notices they targeted
 * the wrong thing — a jsonb blob in a report is not reviewable.
 */
export function describeSegment(
  f: SegmentFilter,
  labels?: { listing?: string; suburbs?: Record<string, string> },
): string {
  const parts: string[] = [];
  if (f.listingId) parts.push(`matched to ${labels?.listing ?? "a listing"}`);
  if (f.roles) parts.push(f.roles.join(" or "));
  if (f.intentTypes) parts.push(`intent ${f.intentTypes.join(" or ")}`);
  if (f.sentiments) parts.push(f.sentiments.join(" or "));
  if (f.wantsSuburbIds) {
    const named = labels?.suburbs
      ? f.wantsSuburbIds.map((id) => labels.suburbs?.[id] ?? "?").join(", ")
      : `${f.wantsSuburbIds.length} suburbs`;
    parts.push(`wants ${named}`);
  }
  if (f.livesInSuburb) parts.push(`lives in ${f.livesInSuburb}`);
  if (f.budgetAtLeast !== undefined && f.budgetAtMost !== undefined) {
    parts.push(`budget ${money(f.budgetAtLeast)}–${money(f.budgetAtMost)}`);
  } else if (f.budgetAtLeast !== undefined) {
    parts.push(`budget from ${money(f.budgetAtLeast)}`);
  } else if (f.budgetAtMost !== undefined) {
    parts.push(`budget to ${money(f.budgetAtMost)}`);
  }
  if (f.rentAtLeastPw !== undefined) parts.push(`rent to $${f.rentAtLeastPw}/wk`);
  if (f.bedsAtLeast !== undefined) parts.push(`${f.bedsAtLeast}+ bed`);
  if (f.bathsAtLeast !== undefined) parts.push(`${f.bathsAtLeast}+ bath`);
  if (f.parkingAtLeast !== undefined) parts.push(`${f.parkingAtLeast}+ car`);
  if (f.propertyTypes) parts.push(f.propertyTypes.join(" or "));
  if (f.timelineAny) parts.push(`timeline ${f.timelineAny.join(" or ")}`);
  if (f.financeStatusAny) parts.push(f.financeStatusAny.join(" or "));
  if (f.notContactedWithinDays !== undefined) {
    parts.push(`not contacted in ${f.notContactedWithinDays} days`);
  }
  if (f.excludeCampaignIds) {
    parts.push(`excluding ${f.excludeCampaignIds.length} earlier campaign(s)`);
  }

  if (parts.length === 0) return "Everyone who can be contacted by SMS";
  const base = parts.join(" · ");
  return f.includeUnknowns ? `${base} · including unstated` : base;
}

function money(n: number): string {
  return n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
}

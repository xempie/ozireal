import { z } from "zod";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { withTenant, type Tx } from "@/db";
import {
  contacts,
  contactPreferences,
  contactPreferenceSuburbs,
  contactIntent,
  listings,
  properties,
  suburbs,
  matches,
  matchRuns,
} from "@/db/schema";
import { hasApiKey } from "@/server/ai/claude";
import { getLlmConfig } from "@/server/ai/config";
import { runTask } from "@/server/ai/run-task";
import { loadPrompt } from "@/server/ai/prompts";
import { hasPgvector } from "@/server/ai/embed";

/**
 * The matching engine (B5.3, §6). Bidirectional and three-staged:
 *
 *   1. HARD FILTERS in SQL: area (suburb or postcode), type, beds, and price or rent
 *      where a listing gives one. Cheap, and it stops stage 3 costing money on
 *      candidates that were never eligible.
 *   2. VECTOR SIMILARITY on the embedded preferences against the embedded listing
 *      description, catching what no WHERE clause expresses.
 *   3. CLAUDE RANKS the survivors and writes one sentence per match.
 *
 * WHAT is matched is the PROPERTY, listed or not (2026-09-30, migration 0017).
 * Off-market deals are matched without any listing. When a property does have an
 * active listing (draft, live or under offer), that listing supplies the price range,
 * sale-or-rent and description; without one, the money filter is skipped and the
 * ranker is told no price is set.
 *
 * Stage 2 is optional at runtime and RECORDED (match_runs.vector_stage_ran), so a
 * thinner result explains itself later. The reason string is never optional: the
 * database enforces matches_reason_not_blank and this code never writes without one.
 */

const STAGE2_LIMIT = 20;
const STAGE1_LIMIT = 200;

/** Parameterised id list for a raw `in (...)`. */
function idList(ids: string[]) {
  return sql.join(
    ids.map((id) => sql`${id}::uuid`),
    sql`, `,
  );
}

/**
 * v2 (2026-09-27): a candidate that meets what the person asked for is always returned,
 * with a reason that says what matches and what is not yet known.
 */
const RANK_PROMPT = "rank-matches.v2";

/** Listing states that count as a property's active campaign. Drafts included. */
export const MATCHABLE_STATUSES: string[] = ["draft", "live", "under_offer"];

/** Property states that are matched. Sold and archived stock is finished. */
export const MATCHABLE_PROPERTY_STATUSES = ["prospect", "appraised", "off_market", "listed"] as const;

export type MatchOutcome = {
  written: number;
  stage1: number;
  stage2: number;
  vectorStageRan: boolean;
  skipped?: string;
};

const rankOutput = z.object({
  matches: z
    .array(
      z.object({
        id: z.string().uuid(),
        score: z.number().min(0).max(1),
        // Mirrors the database constraint: fail HERE, about the model, not later.
        reason: z.string().trim().min(10, "A match needs a real reason").max(400),
      }),
    )
    .max(30),
});

/* ------------------------------------------------------ active listings */

type ActiveListing = {
  id: string;
  propertyId: string;
  status: string;
  listingType: "sale" | "rent";
  priceMin: number | null;
  priceMax: number | null;
  rentPw: number | null;
  headline: string | null;
  copy: string | null;
  priceDisplay: string | null;
  embeddedText: string | null;
};

/**
 * The listing that speaks for each property: a preferred one if given and still
 * active, otherwise the most recently listed active one. A property can hold a draft
 * and a live listing at once; the newest is the current campaign.
 */
async function activeListings(
  tx: Tx,
  propertyIds: string[],
  prefer?: string,
): Promise<Map<string, ActiveListing>> {
  const out = new Map<string, ActiveListing>();
  if (propertyIds.length === 0) return out;
  const rows = await tx
    .select({
      id: listings.id,
      propertyId: listings.propertyId,
      status: listings.status,
      listingType: listings.listingType,
      priceMin: listings.searchPriceMin,
      priceMax: listings.searchPriceMax,
      rentPw: listings.rentPw,
      headline: listings.publicHeadline,
      copy: listings.publicCopy,
      priceDisplay: listings.priceDisplay,
      embeddedText: listings.embeddedText,
    })
    .from(listings)
    .where(
      and(
        inArray(listings.propertyId, propertyIds),
        sql`${listings.status} in ('draft','live','under_offer')`,
      ),
    )
    .orderBy(desc(listings.listedAt), desc(listings.createdAt));
  for (const r of rows) {
    if (prefer && r.id === prefer) out.set(r.propertyId, r);
    else if (!out.has(r.propertyId)) out.set(r.propertyId, r);
  }
  return out;
}

/* -------------------------------------------------- property → contacts */

/** Run from a listing: matches its property, using this listing for price. */
export async function matchContactsForListing(
  tenantId: string,
  listingId: string,
): Promise<MatchOutcome> {
  const l = await withTenant(tenantId, async (tx) => {
    const [row] = await tx
      .select({ propertyId: listings.propertyId, status: listings.status })
      .from(listings)
      .where(eq(listings.id, listingId))
      .limit(1);
    return row ?? null;
  });
  if (!l) return { written: 0, stage1: 0, stage2: 0, vectorStageRan: false, skipped: "gone" };
  if (!MATCHABLE_STATUSES.includes(l.status)) {
    return { written: 0, stage1: 0, stage2: 0, vectorStageRan: false, skipped: "not-live" };
  }
  return matchContactsForProperty(tenantId, l.propertyId, listingId);
}

export async function matchContactsForProperty(
  tenantId: string,
  propertyId: string,
  preferListingId?: string,
): Promise<MatchOutcome> {
  const ctx = await withTenant(tenantId, async (tx) => {
    const [p] = await tx
      .select({
        id: properties.id,
        status: properties.status,
        propertyType: properties.propertyType,
        beds: properties.beds,
        baths: properties.baths,
        parking: properties.parking,
        features: properties.features,
        condition: properties.condition,
        suburbId: properties.suburbId,
        postcode: properties.postcode,
        suburbName: suburbs.name,
        priceExpectation: properties.internalPriceExpectation,
      })
      .from(properties)
      .leftJoin(suburbs, eq(suburbs.id, properties.suburbId))
      .where(eq(properties.id, propertyId))
      .limit(1);
    if (!p) return null;

    const listing = (await activeListings(tx, [p.id], preferListingId)).get(p.id) ?? null;
    const vectorReady = await hasPgvector(tx);

    /**
     * Stage 1. Every predicate is a requirement the contact stated, so a null on their
     * side means "no constraint" and must not exclude them. Every parameter in an
     * `is null` test carries an explicit cast: a bare placeholder there has no
     * inferable type and Postgres refuses the statement (42P08), which once failed
     * this query on every run, invisibly (B5 review).
     */
    const money = !listing
      ? sql`true` // Unlisted: no price to compare. The ranker is told none is set.
      : listing.listingType === "rent"
        ? sql`(${contactPreferences.rentPwMax} is null or ${listing.rentPw ?? null}::int is null or ${contactPreferences.rentPwMax} >= ${listing.rentPw ?? null}::int)`
        : sql`(${contactPreferences.priceMax} is null or ${listing.priceMin ?? null}::int is null or ${contactPreferences.priceMax} >= ${listing.priceMin ?? null}::int)
              and (${contactPreferences.priceMin} is null or ${listing.priceMax ?? null}::int is null or ${contactPreferences.priceMin} <= ${listing.priceMax ?? null}::int)`;

    const candidates = await tx
      .select({
        contactId: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        prefId: contactPreferences.id,
        softRequirements: contactPreferences.softRequirements,
        priceMin: contactPreferences.priceMin,
        priceMax: contactPreferences.priceMax,
        rentPwMax: contactPreferences.rentPwMax,
        bedsMin: contactPreferences.bedsMin,
        bathsMin: contactPreferences.bathsMin,
        propertyTypes: contactPreferences.propertyTypes,
        postcodes: contactPreferences.postcodes,
        suburbNames: sql<string[] | null>`(
          select array_agg(sb.name order by sb.name)
          from contact_preference_suburbs ps join suburbs sb on sb.id = ps.suburb_id
          where ps.preference_id = ${contactPreferences.id}
        )`,
        embeddedText: contactPreferences.embeddedText,
        brief: contactIntent.rollingBrief,
        intentType: contactIntent.intentType,
      })
      .from(contacts)
      .innerJoin(contactPreferences, eq(contactPreferences.contactId, contacts.id))
      .leftJoin(contactIntent, eq(contactIntent.contactId, contacts.id))
      .where(
        and(
          isNull(contacts.tombstonedAt),
          isNull(contacts.mergedIntoId),
          eq(contacts.doNotContact, false),
          money,
          sql`(${contactPreferences.bedsMin} is null or ${p.beds ?? null}::int is null or ${contactPreferences.bedsMin} <= ${p.beds ?? null}::int)`,
          // Type: the shared enum. An EMPTY array means "no preference", as null does.
          sql`(${contactPreferences.propertyTypes} is null
               or cardinality(${contactPreferences.propertyTypes}) = 0
               or ${p.propertyType}::property_type = any(${contactPreferences.propertyTypes}))`,
          // Area: one of their suburbs OR one of their postcodes; neither stated = any.
          sql`(
            (
              not exists (select 1 from contact_preference_suburbs s where s.preference_id = ${contactPreferences.id})
              and coalesce(cardinality(${contactPreferences.postcodes}), 0) = 0
            )
            or exists (
              select 1 from contact_preference_suburbs s
              where s.preference_id = ${contactPreferences.id} and s.suburb_id = ${p.suburbId ?? null}::uuid
            )
            or (${p.postcode ?? null}::text is not null and ${p.postcode ?? null}::text = any(${contactPreferences.postcodes}))
          )`,
        ),
      )
      // Deterministic, so the 200-row cap returns the same slice every run.
      .orderBy(contacts.createdAt, contacts.id)
      .limit(STAGE1_LIMIT);

    return { p, listing, candidates, vectorReady };
  });

  if (!ctx) return { written: 0, stage1: 0, stage2: 0, vectorStageRan: false, skipped: "gone" };
  if (!(MATCHABLE_PROPERTY_STATUSES as readonly string[]).includes(ctx.p.status)) {
    return { written: 0, stage1: 0, stage2: 0, vectorStageRan: false, skipped: "closed" };
  }

  const stage1 = ctx.candidates.length;
  if (!(await hasApiKey(tenantId))) {
    return { written: 0, stage1, stage2: 0, vectorStageRan: false, skipped: "no-api-key" };
  }
  const runSubject = { propertyId, listingId: ctx.listing?.id };
  if (stage1 === 0) {
    await recordRun(tenantId, { ...runSubject, stage1: 0, stage2: 0, stage3: 0, vectorStageRan: false });
    return { written: 0, stage1: 0, stage2: 0, vectorStageRan: false };
  }

  /**
   * Stage 2, only where there is a listing embedding to compare against. The cap
   * applies unconditionally at the end, and partial embedding coverage affects ORDER,
   * never eligibility: ranked candidates lead, the rest fill the shortlist (B5 review).
   */
  let shortlist = ctx.candidates.map((c) => ({ ...c, similarity: null as number | null }));
  let vectorStageRan = false;
  if (ctx.vectorReady && ctx.listing && ctx.candidates.length > STAGE2_LIMIT) {
    const listingId = ctx.listing.id;
    const ranked = await withTenant(tenantId, (tx) =>
      tx.execute<{ contact_id: string; similarity: number }>(
        sql`select cp.contact_id, 1 - (cp.embedding <=> l.embedding) as similarity
            from contact_preferences cp
            cross join (select embedding from listings where id = ${listingId}) l
            where cp.embedding is not null and l.embedding is not null
              and cp.contact_id in (${idList(ctx.candidates.map((c) => c.contactId))})
            order by cp.embedding <=> l.embedding
            limit ${STAGE2_LIMIT}`,
      ),
    );
    if (ranked.length > 0) {
      vectorStageRan = true;
      const byId = new Map(ranked.map((r) => [r.contact_id, Number(r.similarity)]));
      shortlist = [
        ...ctx.candidates.filter((c) => byId.has(c.contactId)).map((c) => ({ ...c, similarity: byId.get(c.contactId)! })),
        ...ctx.candidates.filter((c) => !byId.has(c.contactId)).map((c) => ({ ...c, similarity: null as number | null })),
      ];
    }
  }
  shortlist = shortlist.slice(0, STAGE2_LIMIT);

  const config = await getLlmConfig(tenantId);
  const prompt = loadPrompt(RANK_PROMPT);
  const { data, generationId } = await runTask(rankOutput, {
    task: "rank-matches:property",
    model: "sonnet",
    output: "structured",
    tenantId,
    entity: { type: "property", id: propertyId },
    promptVersion: prompt.version,
    system: [{ text: prompt.text, cache: true }],
    maxTokens: config.rankingMaxTokens,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          subject: propertyForRanker(ctx.p, ctx.listing),
          /**
           * `stated` is what each person asked for. Without it the ranker saw only a
           * brief and soft requirements, so a buyer with neither looked like someone
           * with no wants and was dropped (2026-09-27).
           */
          candidates: shortlist.map((c) => ({
            id: c.contactId,
            name: `${c.firstName} ${c.lastName}`,
            stated: {
              suburbs: c.suburbNames ?? [],
              postcodes: c.postcodes ?? [],
              priceMin: c.priceMin,
              priceMax: c.priceMax,
              rentPerWeekMax: c.rentPwMax,
              bedsMin: c.bedsMin,
              bathsMin: c.bathsMin,
              propertyTypes: c.propertyTypes ?? [],
            },
            summary: c.embeddedText ?? c.brief ?? null,
            softRequirements: c.softRequirements,
            intentType: c.intentType,
            similarity: c.similarity,
          })),
        }),
      },
    ],
  });

  const valid = data.matches.filter((m) => shortlist.some((c) => c.contactId === m.id));
  await writeMatches(
    tenantId,
    valid.map((m) => ({
      propertyId,
      listingId: ctx.listing?.id ?? null,
      contactId: m.id,
      score: m.score,
      reason: m.reason,
      generationId,
    })),
  );
  await recordRun(tenantId, {
    ...runSubject,
    stage1,
    stage2: vectorStageRan ? shortlist.length : 0,
    stage3: valid.length,
    vectorStageRan,
    generationId,
  });
  return { written: valid.length, stage1, stage2: shortlist.length, vectorStageRan };
}

/** What the ranker knows about a property: its facts, plus its campaign if it has one. */
function propertyForRanker(
  p: {
    propertyType: string;
    suburbName: string | null;
    postcode: string | null;
    beds: number | null;
    baths: number | null;
    parking: number | null;
    features: string[] | null;
    condition: string | null;
    priceExpectation: string | null;
  },
  l: ActiveListing | null,
) {
  return {
    kind: "property",
    propertyType: p.propertyType,
    suburb: p.suburbName,
    postcode: p.postcode,
    beds: p.beds,
    baths: p.baths,
    parking: p.parking,
    features: p.features ?? [],
    condition: p.condition,
    listing: l
      ? {
          status: l.status,
          listingType: l.listingType,
          priceDisplay: l.priceDisplay,
          priceMin: l.priceMin,
          priceMax: l.priceMax,
          rentPerWeek: l.rentPw,
          headline: l.headline,
          description: l.embeddedText ?? l.copy,
        }
      : null,
    // Internal only, and this call is internal: the owner's own expectation is the
    // best price signal an unlisted property has.
    ownerPriceExpectation: l ? null : p.priceExpectation,
    note: l ? null : "Not listed: no advertised price or sale/rent decided yet.",
  };
}

/* -------------------------------------------------- contact → properties */

/** Kept under its old name for the MatchListings job. */
export const matchListingsForContact = matchPropertiesForContact;

export async function matchPropertiesForContact(
  tenantId: string,
  contactId: string,
): Promise<MatchOutcome> {
  const ctx = await withTenant(tenantId, async (tx) => {
    const [c] = await tx
      .select({
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        doNotContact: contacts.doNotContact,
        tombstonedAt: contacts.tombstonedAt,
        mergedIntoId: contacts.mergedIntoId,
        prefId: contactPreferences.id,
        priceMin: contactPreferences.priceMin,
        priceMax: contactPreferences.priceMax,
        bedsMin: contactPreferences.bedsMin,
        bathsMin: contactPreferences.bathsMin,
        rentPwMax: contactPreferences.rentPwMax,
        propertyTypes: contactPreferences.propertyTypes,
        postcodes: contactPreferences.postcodes,
        softRequirements: contactPreferences.softRequirements,
        embeddedText: contactPreferences.embeddedText,
        brief: contactIntent.rollingBrief,
      })
      .from(contacts)
      .innerJoin(contactPreferences, eq(contactPreferences.contactId, contacts.id))
      .leftJoin(contactIntent, eq(contactIntent.contactId, contacts.id))
      .where(eq(contacts.id, contactId))
      .limit(1);
    // doNotContact is excluded in both directions, so one person is matchable
    // from both sides or neither.
    if (!c || c.tombstonedAt || c.mergedIntoId || c.doNotContact) return null;

    const vectorReady = await hasPgvector(tx);
    const subs = await tx
      .select({ id: suburbs.id, name: suburbs.name })
      .from(contactPreferenceSuburbs)
      .innerJoin(suburbs, eq(suburbs.id, contactPreferenceSuburbs.suburbId))
      .where(eq(contactPreferenceSuburbs.preferenceId, c.prefId));

    const props = await tx
      .select({
        id: properties.id,
        propertyType: properties.propertyType,
        beds: properties.beds,
        baths: properties.baths,
        parking: properties.parking,
        features: properties.features,
        condition: properties.condition,
        suburbName: suburbs.name,
        postcode: properties.postcode,
        priceExpectation: properties.internalPriceExpectation,
      })
      .from(properties)
      .leftJoin(suburbs, eq(suburbs.id, properties.suburbId))
      .where(
        and(
          inArray(properties.status, [...MATCHABLE_PROPERTY_STATUSES]),
          sql`(${c.bedsMin ?? null}::int is null or ${properties.beds} is null or ${properties.beds} >= ${c.bedsMin ?? null}::int)`,
          // inArray, not `= any(${array})`: Drizzle renders a JS array there as a
          // tuple and Postgres refuses it (42809).
          c.propertyTypes?.length ? inArray(properties.propertyType, c.propertyTypes) : sql`true`,
          subs.length || c.postcodes?.length
            ? or(
                subs.length ? sql`${properties.suburbId} in (${idList(subs.map((x) => x.id))})` : sql`false`,
                c.postcodes?.length ? inArray(properties.postcode, c.postcodes) : sql`false`,
              )
            : sql`true`,
        ),
      )
      .orderBy(properties.createdAt, properties.id)
      .limit(STAGE1_LIMIT);

    /**
     * Money, where a property's active listing gives one. Sale and rental are
     * different markets with different columns; a rental is never compared with a
     * sale budget, which once passed everyone. Unlisted properties have no price and
     * pass; the ranker is told so.
     */
    const active = await activeListings(tx, props.map((p) => p.id));
    const candidates = props
      .map((p) => ({ ...p, listing: active.get(p.id) ?? null }))
      .filter(({ listing: l }) => {
        if (!l) return true;
        if (l.listingType === "rent") {
          return c.rentPwMax == null || l.rentPw == null || l.rentPw <= c.rentPwMax;
        }
        return (
          (c.priceMax == null || l.priceMin == null || l.priceMin <= c.priceMax) &&
          (c.priceMin == null || l.priceMax == null || l.priceMax >= c.priceMin)
        );
      });

    return { c, subs, candidates, vectorReady };
  });

  if (!ctx) return { written: 0, stage1: 0, stage2: 0, vectorStageRan: false, skipped: "gone" };

  const stage1 = ctx.candidates.length;
  if (!(await hasApiKey(tenantId))) {
    return { written: 0, stage1, stage2: 0, vectorStageRan: false, skipped: "no-api-key" };
  }
  if (stage1 === 0) {
    await recordRun(tenantId, { contactId, stage1: 0, stage2: 0, stage3: 0, vectorStageRan: false });
    return { written: 0, stage1: 0, stage2: 0, vectorStageRan: false };
  }

  // Stage 2 over the candidates that have a listing embedding; the rest keep their place.
  let shortlist = ctx.candidates.map((p) => ({ ...p, similarity: null as number | null }));
  let vectorStageRan = false;
  const withListing = ctx.candidates.filter((p) => p.listing);
  if (ctx.vectorReady && ctx.candidates.length > STAGE2_LIMIT && withListing.length) {
    const ranked = await withTenant(tenantId, (tx) =>
      tx.execute<{ id: string; similarity: number }>(
        sql`select l.id, 1 - (l.embedding <=> cp.embedding) as similarity
            from listings l
            cross join (select embedding from contact_preferences where contact_id = ${contactId}) cp
            where l.embedding is not null and cp.embedding is not null
              and l.id in (${idList(withListing.map((p) => p.listing!.id))})
            order by l.embedding <=> cp.embedding
            limit ${STAGE2_LIMIT}`,
      ),
    );
    if (ranked.length > 0) {
      vectorStageRan = true;
      const byListing = new Map(ranked.map((r) => [r.id, Number(r.similarity)]));
      const sim = (p: (typeof shortlist)[number]) => (p.listing ? byListing.get(p.listing.id) : undefined);
      shortlist = [
        ...shortlist.filter((p) => sim(p) !== undefined).map((p) => ({ ...p, similarity: sim(p)! })),
        ...shortlist.filter((p) => sim(p) === undefined),
      ];
    }
  }
  shortlist = shortlist.slice(0, STAGE2_LIMIT);

  const config = await getLlmConfig(tenantId);
  const prompt = loadPrompt(RANK_PROMPT);
  const { data, generationId } = await runTask(rankOutput, {
    task: "rank-matches:contact",
    model: "sonnet",
    output: "structured",
    tenantId,
    entity: { type: "contact", id: contactId },
    promptVersion: prompt.version,
    system: [{ text: prompt.text, cache: true }],
    maxTokens: config.rankingMaxTokens,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          subject: {
            kind: "contact",
            name: `${ctx.c.firstName} ${ctx.c.lastName}`,
            stated: {
              suburbs: ctx.subs.map((s) => s.name),
              postcodes: ctx.c.postcodes ?? [],
              priceMin: ctx.c.priceMin,
              priceMax: ctx.c.priceMax,
              rentPerWeekMax: ctx.c.rentPwMax,
              bedsMin: ctx.c.bedsMin,
              bathsMin: ctx.c.bathsMin,
              propertyTypes: ctx.c.propertyTypes ?? [],
            },
            summary: ctx.c.embeddedText ?? ctx.c.brief ?? null,
            softRequirements: ctx.c.softRequirements,
          },
          candidates: shortlist.map((p) => ({
            id: p.id,
            ...propertyForRanker(p, p.listing),
            similarity: p.similarity,
          })),
        }),
      },
    ],
  });

  const valid = data.matches.filter((m) => shortlist.some((p) => p.id === m.id));
  await writeMatches(
    tenantId,
    valid.map((m) => ({
      propertyId: m.id,
      listingId: shortlist.find((p) => p.id === m.id)?.listing?.id ?? null,
      contactId,
      score: m.score,
      reason: m.reason,
      generationId,
    })),
  );
  await recordRun(tenantId, {
    contactId,
    stage1,
    stage2: vectorStageRan ? shortlist.length : 0,
    stage3: valid.length,
    vectorStageRan,
    generationId,
  });
  return { written: valid.length, stage1, stage2: shortlist.length, vectorStageRan };
}

/* ---------------------------------------------------------------- writes */

/**
 * Upsert on (property, contact): re-running refreshes the pair, and a better reason
 * wins. The listing is refreshed too, since the property's campaign may have changed.
 */
async function writeMatches(
  tenantId: string,
  rows: {
    propertyId: string;
    listingId: string | null;
    contactId: string;
    score: number;
    reason: string;
    generationId: string;
  }[],
) {
  if (rows.length === 0) return;
  await withTenant(tenantId, async (tx) => {
    for (const r of rows) {
      await tx
        .insert(matches)
        .values({
          tenantId,
          propertyId: r.propertyId,
          listingId: r.listingId,
          contactId: r.contactId,
          score: r.score,
          reason: r.reason,
          stage: "ranked",
          aiGenerationId: r.generationId,
        })
        .onConflictDoUpdate({
          target: [matches.propertyId, matches.contactId],
          set: {
            listingId: r.listingId,
            score: r.score,
            reason: r.reason,
            stage: "ranked",
            aiGenerationId: r.generationId,
            generatedAt: new Date(),
          },
        });
    }
  });
}

async function recordRun(
  tenantId: string,
  r: {
    propertyId?: string;
    listingId?: string;
    contactId?: string;
    stage1: number;
    stage2: number;
    stage3: number;
    vectorStageRan: boolean;
    generationId?: string;
  },
) {
  await withTenant(tenantId, (tx) =>
    tx.insert(matchRuns).values({
      tenantId,
      propertyId: r.propertyId ?? null,
      listingId: r.listingId ?? null,
      contactId: r.contactId ?? null,
      stage1Count: r.stage1,
      stage2Count: r.stage2,
      stage3Count: r.stage3,
      vectorStageRan: r.vectorStageRan,
      aiGenerationId: r.generationId ?? null,
      note: r.vectorStageRan
        ? null
        : "Vector stage did not run: pgvector unavailable, nothing embedded, or the shortlist was already small.",
    }),
  );
}

import { z } from "zod";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { withTenant } from "@/db";
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
 *   1. HARD FILTERS in SQL — price band, beds, suburb, availability. Cheap, and
 *      it is what stops stage 3 costing money on candidates that were never
 *      eligible.
 *   2. VECTOR SIMILARITY on the embedded preference summary against the embedded
 *      property description. This is the stage that earns the feature: it catches
 *      "quiet at school pick-up" and "somewhere the dog can run", which no WHERE
 *      clause expresses.
 *   3. CLAUDE RANKS the survivors and writes one sentence per match.
 *
 * Stage 2 is optional at runtime. Where pgvector is absent the run proceeds on
 * stages 1 and 3 and RECORDS that it did (match_runs.vector_stage_ran), so a
 * thinner result set explains itself months later instead of looking like a bug.
 *
 * The reason string is not optional (§6). The database enforces it with
 * matches_reason_not_blank; this code never writes a match without one.
 */

const STAGE2_LIMIT = 20;
const STAGE1_LIMIT = 200;

/**
 * A parameterised id list for a raw `in (...)`.
 *
 * These ids come from our own database, so this is not plugging a live hole — but
 * building SQL by string-joining values is the habit that eventually meets a value
 * that did not come from us. Parameters also let Postgres plan the query once
 * rather than seeing a new statement for every candidate set.
 */
function idList(ids: string[]) {
  return sql.join(
    ids.map((id) => sql`${id}::uuid`),
    sql`, `,
  );
}

/** Listing states matching works on. Drafts included: off-market deals are matched unpublished. */
export const MATCHABLE_STATUSES: string[] = ["draft", "live", "under_offer"];

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
        // Mirrors the database constraint. A blank reason must fail HERE, with a
        // message about the model, rather than as a constraint violation later.
        reason: z.string().trim().min(10, "A match needs a real reason").max(400),
      }),
    )
    .max(30),
});

/* --------------------------------------------------- listing → contacts */

export async function matchContactsForListing(
  tenantId: string,
  listingId: string,
): Promise<MatchOutcome> {
  /**
   * The API-key check used to come FIRST, which meant every test returned before
   * the SQL ran — and the stage-1 query was broken on every real invocation for
   * as long as it existed. Gathering candidates first costs one cheap query and
   * means the filter is exercised by anything that calls this. Found by the B5
   * review; tests/matching.test.ts now depends on this ordering.
   */
  const ctx = await withTenant(tenantId, async (tx) => {
    const [l] = await tx
      .select({
        id: listings.id,
        status: listings.status,
        listingType: listings.listingType,
        priceMin: listings.searchPriceMin,
        priceMax: listings.searchPriceMax,
        rentPw: listings.rentPw,
        headline: listings.publicHeadline,
        copy: listings.publicCopy,
        priceDisplay: listings.priceDisplay,
        embeddedText: listings.embeddedText,
        propertyType: properties.propertyType,
        beds: properties.beds,
        baths: properties.baths,
        parking: properties.parking,
        features: properties.features,
        suburbId: properties.suburbId,
        postcode: properties.postcode,
        suburbName: suburbs.name,
      })
      .from(listings)
      .innerJoin(properties, eq(properties.id, listings.propertyId))
      .leftJoin(suburbs, eq(suburbs.id, properties.suburbId))
      .where(eq(listings.id, listingId))
      .limit(1);
    if (!l) return null;

    const vectorReady = await hasPgvector(tx);

    /**
     * Stage 1. Every predicate is a HARD requirement the contact stated, so a
     * null on their side means "no constraint" and must not exclude them —
     * getting that backwards silently empties the funnel, which is exactly the
     * bug B1 caught when 'House' failed to match 'house'.
     */
    const candidates = await tx
      .select({
        contactId: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        prefId: contactPreferences.id,
        softRequirements: contactPreferences.softRequirements,
        priceMin: contactPreferences.priceMin,
        priceMax: contactPreferences.priceMax,
        bedsMin: contactPreferences.bedsMin,
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
          // Price: their max must cover our min, and their min must not exceed
          // our max. Nulls mean unconstrained.
          /**
           * Every parameter that appears in an `is null` test carries an explicit
           * cast. Without one Postgres cannot infer the type of a bare placeholder
           * in that position and refuses the whole statement with 42P08 — which
           * meant this query failed on EVERY run, invisibly, because hasApiKey()
           * returns early in tests and the SQL was never reached. Found by the B5
           * review; the regression test below now exercises the SQL with no key.
           */
          sql`(${contactPreferences.priceMax} is null or ${l.priceMin ?? null}::int is null or ${contactPreferences.priceMax} >= ${l.priceMin ?? null}::int)`,
          sql`(${contactPreferences.priceMin} is null or ${l.priceMax ?? null}::int is null or ${contactPreferences.priceMin} <= ${l.priceMax ?? null}::int)`,
          sql`(${contactPreferences.bedsMin} is null or ${l.beds ?? null}::int is null or ${contactPreferences.bedsMin} <= ${l.beds ?? null}::int)`,
          // Property type: the shared enum, so 'house' compares to 'house'. An
          // EMPTY array means "no stated preference" just as null does — the two
          // directions disagreed on this, so one of them silently excluded people.
          sql`(${contactPreferences.propertyTypes} is null
               or cardinality(${contactPreferences.propertyTypes}) = 0
               or ${l.propertyType}::property_type = any(${contactPreferences.propertyTypes}))`,
          /**
           * Rentals were matched on sale price, which is null on a rental listing —
           * so the price gate passed everyone. Compare like with like, and never
           * cross a rental listing with a buyer's sale budget.
           */
          l.listingType === "rent"
            ? sql`(${contactPreferences.rentPwMax} is null or ${l.rentPw ?? null}::int is null or ${contactPreferences.rentPwMax} >= ${l.rentPw ?? null}::int)`
            : sql`true`,
          /**
           * Area: in one of their suburbs OR one of their postcodes (0015). With
           * neither stated, any area. The ::uuid / ::text casts are the 42P08 rule
           * above: a bare placeholder in these positions has no inferable type.
           */
          sql`(
            (
              not exists (select 1 from contact_preference_suburbs s where s.preference_id = ${contactPreferences.id})
              and coalesce(cardinality(${contactPreferences.postcodes}), 0) = 0
            )
            or exists (
              select 1 from contact_preference_suburbs s
              where s.preference_id = ${contactPreferences.id} and s.suburb_id = ${l.suburbId ?? null}::uuid
            )
            or (${l.postcode ?? null}::text is not null and ${l.postcode ?? null}::text = any(${contactPreferences.postcodes}))
          )`,
        ),
      )
      // Deterministic: without an ORDER BY the 200-row cap returns a different
      // slice run to run, so the same listing matched different people each time.
      .orderBy(contacts.createdAt, contacts.id)
      .limit(STAGE1_LIMIT);

    return { l, candidates, vectorReady };
  });

  if (!ctx) return { written: 0, stage1: 0, stage2: 0, vectorStageRan: false, skipped: "gone" };
  /**
   * Draft listings match too (decided 2026-09-27): off-market deals are often matched
   * and placed without ever being published. Matching sends nothing and a draft is
   * never public, so publication is no precondition. Only finished campaigns (sold,
   * leased, withdrawn) are refused.
   */
  if (!MATCHABLE_STATUSES.includes(ctx.l.status)) {
    return { written: 0, stage1: 0, stage2: 0, vectorStageRan: false, skipped: "not-live" };
  }

  const stage1 = ctx.candidates.length;
  if (!(await hasApiKey(tenantId))) {
    // Stage 1 ran and is reported honestly; only the ranking needs the key.
    return { written: 0, stage1, stage2: 0, vectorStageRan: false, skipped: "no-api-key" };
  }
  if (stage1 === 0) {
    await recordRun(tenantId, { listingId, stage1: 0, stage2: 0, stage3: 0, vectorStageRan: false });
    return { written: 0, stage1: 0, stage2: 0, vectorStageRan: false };
  }

  /**
   * Stage 2: narrow to the most similar, where the extension exists.
   *
   * Two rules that the first version got wrong, both found by the B5 review:
   *
   *   - the cap is applied UNCONDITIONALLY at the end. Previously it lived in the
   *     else branch, so any run where the vector query returned nothing sent all
   *     200 stage-1 candidates into a Sonnet prompt — the exact cost blow-up
   *     stage 2 exists to prevent.
   *   - partial embedding coverage must not silently drop people. The vector query
   *     only sees rows WITH an embedding, so during a backfill it would return
   *     three neighbours and quietly discard 197 eligible candidates while
   *     match_runs recorded a clean vector run. Now the ranked ones lead and the
   *     remainder fill the shortlist, so coverage affects ORDER, never eligibility.
   */
  let shortlist = ctx.candidates.map((c) => ({ ...c, similarity: null as number | null }));
  let vectorStageRan = false;

  if (ctx.vectorReady && ctx.candidates.length > STAGE2_LIMIT) {
    const ranked = await withTenant(tenantId, (tx) =>
      tx.execute<{ contact_id: string; similarity: number }>(
        sql`select cp.contact_id,
                   1 - (cp.embedding <=> l.embedding) as similarity
            from contact_preferences cp
            cross join (select embedding from listings where id = ${listingId}) l
            where cp.embedding is not null
              and l.embedding is not null
              and cp.contact_id in (${idList(ctx.candidates.map((c) => c.contactId))})
            order by cp.embedding <=> l.embedding
            limit ${STAGE2_LIMIT}`,
      ),
    );
    if (ranked.length > 0) {
      vectorStageRan = true;
      const byId = new Map(ranked.map((r) => [r.contact_id, Number(r.similarity)]));
      const scored = ctx.candidates
        .filter((c) => byId.has(c.contactId))
        .map((c) => ({ ...c, similarity: byId.get(c.contactId)! }));
      const unscored = ctx.candidates
        .filter((c) => !byId.has(c.contactId))
        .map((c) => ({ ...c, similarity: null as number | null }));
      shortlist = [...scored, ...unscored];
    }
  }
  // The cap, applied on every path.
  shortlist = shortlist.slice(0, STAGE2_LIMIT);

  /** Stage 3: Claude ranks and writes the sentence. */
  const config = await getLlmConfig(tenantId);
  const prompt = loadPrompt("rank-matches.v1");
  const { data, generationId } = await runTask(rankOutput, {
    task: "rank-matches:listing",
    model: "sonnet",
    output: "structured",
    tenantId,
    entity: { type: "listing", id: listingId },
    promptVersion: prompt.version,
    system: [{ text: prompt.text, cache: true }],
    maxTokens: config.rankingMaxTokens,
    messages: [
      {
        role: "user",
        content: JSON.stringify({
          subject: {
            kind: "listing",
            headline: ctx.l.headline,
            description: ctx.l.embeddedText ?? ctx.l.copy,
            propertyType: ctx.l.propertyType,
            suburb: ctx.l.suburbName,
            beds: ctx.l.beds,
            baths: ctx.l.baths,
            parking: ctx.l.parking,
            features: ctx.l.features ?? [],
            priceDisplay: ctx.l.priceDisplay,
          },
          candidates: shortlist.map((c) => ({
            id: c.contactId,
            name: `${c.firstName} ${c.lastName}`,
            summary: c.embeddedText ?? c.brief ?? c.softRequirements ?? "No stated preferences.",
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
      listingId,
      contactId: m.id,
      score: m.score,
      reason: m.reason,
      generationId,
    })),
  );
  await recordRun(tenantId, {
    listingId,
    stage1,
    // Only a stage that RAN gets a count; otherwise the funnel reads as though
    // similarity narrowed something when it never executed.
    stage2: vectorStageRan ? shortlist.length : 0,
    stage3: valid.length,
    vectorStageRan,
    generationId,
  });

  return { written: valid.length, stage1, stage2: shortlist.length, vectorStageRan };
}

/* --------------------------------------------------- contact → listings */

export async function matchListingsForContact(
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
    // doNotContact excluded people in the listing→contacts direction but not this
    // one, so the same person was matchable from one side and not the other.
    if (!c || c.tombstonedAt || c.mergedIntoId || c.doNotContact) return null;

    const vectorReady = await hasPgvector(tx);

    const subs = await tx
      .select({ id: suburbs.id, name: suburbs.name })
      .from(contactPreferenceSuburbs)
      .innerJoin(suburbs, eq(suburbs.id, contactPreferenceSuburbs.suburbId))
      .where(eq(contactPreferenceSuburbs.preferenceId, c.prefId));

    const candidates = await tx
      .select({
        listingId: listings.id,
        headline: listings.publicHeadline,
        copy: listings.publicCopy,
        priceDisplay: listings.priceDisplay,
        embeddedText: listings.embeddedText,
        propertyType: properties.propertyType,
        beds: properties.beds,
        baths: properties.baths,
        parking: properties.parking,
        features: properties.features,
        suburbName: suburbs.name,
      })
      .from(listings)
      .innerJoin(properties, eq(properties.id, listings.propertyId))
      .leftJoin(suburbs, eq(suburbs.id, properties.suburbId))
      .orderBy(listings.listedAt, listings.id)
      .where(
        and(
          // Drafts included: see MATCHABLE_STATUSES.
          sql`${listings.status} in ('draft','live','under_offer')`,
          /**
           * Sale and rental are different markets with different money columns.
           * Comparing a rental listing against a sale budget compared a number to
           * null and passed everyone; the split keeps each side honest.
           */
          sql`(
            (${listings.listingType} = 'sale'
              and (${c.priceMax ?? null}::int is null or ${listings.searchPriceMin} is null or ${listings.searchPriceMin} <= ${c.priceMax ?? null}::int)
              and (${c.priceMin ?? null}::int is null or ${listings.searchPriceMax} is null or ${listings.searchPriceMax} >= ${c.priceMin ?? null}::int))
            or
            (${listings.listingType} = 'rent'
              and (${c.rentPwMax ?? null}::int is null or ${listings.rentPw} is null or ${listings.rentPw} <= ${c.rentPwMax ?? null}::int))
          )`,
          sql`(${c.bedsMin ?? null}::int is null or ${properties.beds} is null or ${properties.beds} >= ${c.bedsMin ?? null}::int)`,
          /**
           * inArray, not `= any(${array})`. Drizzle renders a JS array in that
           * position as a TUPLE — `any(($9, $10))` — and Postgres refuses it with
           * 42809 because ANY needs an array on the right. Found the moment a test
           * finally executed this query.
           */
          c.propertyTypes?.length
            ? inArray(properties.propertyType, c.propertyTypes)
            : sql`true`,
          // Area: one of their suburbs OR one of their postcodes (0015); neither = open.
          subs.length || c.postcodes?.length
            ? or(
                subs.length
                  ? sql`${properties.suburbId} in (${idList(subs.map((x) => x.id))})`
                  : sql`false`,
                c.postcodes?.length ? inArray(properties.postcode, c.postcodes) : sql`false`,
              )
            : sql`true`,
        ),
      )
      .limit(STAGE1_LIMIT);

    return { c, candidates, vectorReady };
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

  let shortlist = ctx.candidates.map((l) => ({ ...l, similarity: null as number | null }));
  let vectorStageRan = false;

  if (ctx.vectorReady && ctx.candidates.length > STAGE2_LIMIT) {
    const ranked = await withTenant(tenantId, (tx) =>
      tx.execute<{ id: string; similarity: number }>(
        sql`select l.id, 1 - (l.embedding <=> cp.embedding) as similarity
            from listings l
            cross join (select embedding from contact_preferences where contact_id = ${contactId}) cp
            where l.embedding is not null and cp.embedding is not null
              and l.id in (${idList(ctx.candidates.map((c) => c.listingId))})
            order by l.embedding <=> cp.embedding
            limit ${STAGE2_LIMIT}`,
      ),
    );
    if (ranked.length > 0) {
      vectorStageRan = true;
      const byId = new Map(ranked.map((r) => [r.id, Number(r.similarity)]));
      const scored = ctx.candidates
        .filter((l) => byId.has(l.listingId))
        .map((l) => ({ ...l, similarity: byId.get(l.listingId)! }));
      const unscored = ctx.candidates
        .filter((l) => !byId.has(l.listingId))
        .map((l) => ({ ...l, similarity: null as number | null }));
      shortlist = [...scored, ...unscored];
    }
  }
  shortlist = shortlist.slice(0, STAGE2_LIMIT);

  const config = await getLlmConfig(tenantId);
  const prompt = loadPrompt("rank-matches.v1");
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
            summary: ctx.c.embeddedText ?? ctx.c.brief ?? "No brief yet.",
            softRequirements: ctx.c.softRequirements,
          },
          candidates: shortlist.map((l) => ({
            id: l.listingId,
            summary: l.embeddedText ?? l.copy ?? l.headline ?? "No description.",
            propertyType: l.propertyType,
            suburb: l.suburbName,
            beds: l.beds,
            baths: l.baths,
            parking: l.parking,
            features: l.features ?? [],
            priceDisplay: l.priceDisplay,
            similarity: l.similarity,
          })),
        }),
      },
    ],
  });

  const valid = data.matches.filter((m) => shortlist.some((l) => l.listingId === m.id));
  await writeMatches(
    tenantId,
    valid.map((m) => ({
      listingId: m.id,
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
 * Upsert, because re-running matching must refresh a pair rather than collide with
 * the (listing, contact) unique index. A re-run with a better reason should win.
 */
async function writeMatches(
  tenantId: string,
  rows: {
    listingId: string;
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
          listingId: r.listingId,
          contactId: r.contactId,
          score: r.score,
          reason: r.reason,
          stage: "ranked",
          aiGenerationId: r.generationId,
        })
        .onConflictDoUpdate({
          target: [matches.listingId, matches.contactId],
          set: {
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
      listingId: r.listingId ?? null,
      contactId: r.contactId ?? null,
      stage1Count: r.stage1,
      stage2Count: r.stage2,
      stage3Count: r.stage3,
      vectorStageRan: r.vectorStageRan,
      aiGenerationId: r.generationId ?? null,
      note: r.vectorStageRan
        ? null
        : "Vector stage did not run — pgvector unavailable or nothing embedded.",
    }),
  );
}

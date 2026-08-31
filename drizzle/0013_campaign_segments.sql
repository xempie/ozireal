--------------------------------------------------------------------------------
-- Segments: recording WHO a campaign was aimed at, and why.
--
-- A campaign currently records its name, channel and recipients. It does not
-- record the question that produced those recipients, so "why did Marco get this
-- and Priya not?" is unanswerable a week later — and that is precisely the
-- question asked when a send goes wrong.
--
-- The filter is stored as jsonb rather than normalised into columns because it is
-- a DOCUMENT, not a relation: it is written once, read whole, and never queried
-- across campaigns. Normalising it would mean a migration every time a filter
-- gains a field.
--
-- `saved_views.filter` already exists with the same shape and has never had a
-- reader — the seed writes a placeholder {"note": "..."} and the console renders
-- the rows as dashed, unclickable spans. Both columns are now read by the same
-- Zod schema in src/server/segments/schema.ts, which is what turns a saved view
-- from a label into something that can actually be applied.
--------------------------------------------------------------------------------

ALTER TABLE "campaigns"
  ADD COLUMN IF NOT EXISTS "segment" jsonb;

COMMENT ON COLUMN "campaigns"."segment" IS
  'The SegmentFilter that produced this campaign''s recipients. Parsed by src/server/segments/schema.ts.';

/**
 * Which saved view it came from, when it came from one.
 *
 * Nullable and ON DELETE SET NULL on purpose: the campaign keeps its own copy of
 * the filter above, so deleting a saved view must never destroy the record of who
 * a campaign went to. The link is provenance, not the source of truth.
 */
ALTER TABLE "campaigns"
  ADD COLUMN IF NOT EXISTS "saved_view_id" uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'campaigns_saved_view_fk'
  ) THEN
    ALTER TABLE "campaigns"
      ADD CONSTRAINT "campaigns_saved_view_fk"
      FOREIGN KEY ("saved_view_id") REFERENCES "saved_views"("id") ON DELETE SET NULL;
  END IF;
END $$;

/**
 * A drafting token ceiling, separate from the extraction one.
 *
 * An SMS body is a couple of hundred characters; extraction_max_tokens is 1200
 * because it returns a whole structured summary. Borrowing that number would work
 * and would be a lie about what the task needs — and the ceiling is load-bearing,
 * because callClaude treats a max_tokens stop as a NON-retryable failure that has
 * already been billed.
 */
ALTER TABLE "llm_settings"
  ADD COLUMN IF NOT EXISTS "draft_max_tokens" integer NOT NULL DEFAULT 400;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'llm_draft_max_tokens_sane'
  ) THEN
    ALTER TABLE "llm_settings"
      ADD CONSTRAINT "llm_draft_max_tokens_sane"
      CHECK ("draft_max_tokens" BETWEEN 100 AND 4000);
  END IF;
END $$;

/**
 * The index the segment preview leans on.
 *
 * Every preview asks the same question of consents — the current row per contact
 * per channel — and gate.ts orders by (occurred_at DESC, created_at DESC) because
 * two rows can share an occurred_at and "whichever the planner returned first" is
 * not a consent policy. The existing consents_contact_channel_idx stops at
 * occurred_at, so the tie-break sorts in memory on every preview.
 */
CREATE INDEX IF NOT EXISTS "consents_current_idx"
  ON "consents" ("contact_id", "channel", "occurred_at" DESC, "created_at" DESC);

/**
 * Reverse merge lookups are unindexed and both the consent gate and the segment
 * preview do one per contact: "which records were merged INTO this one".
 */
CREATE INDEX IF NOT EXISTS "contacts_merged_into_idx"
  ON "contacts" ("merged_into_id") WHERE "merged_into_id" IS NOT NULL;

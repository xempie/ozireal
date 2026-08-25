--------------------------------------------------------------------------------
-- B5.1: embeddings for similarity matching.
--
-- §6 stage 2 compares an embedded preference summary against an embedded property
-- description, catching the soft signals a WHERE clause cannot express ("quiet at
-- school pick-up", "somewhere the dog can run").
--
-- This migration applies WHETHER OR NOT pgvector is present.
--
-- That is deliberate, not a hedge. The dev machine cannot install the extension —
-- no admin rights, no Docker daemon, no WSL distro — while the AWS target has it
-- as a one-line install. A migration that hard-failed on the extension would mean
-- the schema could not be applied locally at all, so every other table in this
-- phase would be untestable for the sake of one column. Instead: real vector
-- columns and HNSW indexes where pgvector exists, and nowhere else. The matcher
-- checks at runtime and says plainly when it is running without stage 2.
--
-- Dimension 1024: Voyage's default for the Voyage 4 series (and the fixed size of
-- voyage-law-2, which the compliance corpus will use in B7). Pinning it here means
-- an accidental model swap fails loudly on insert rather than silently poisoning
-- the index with vectors of a different shape.
--------------------------------------------------------------------------------

DO $$
DECLARE
  has_vector boolean;
BEGIN
  -- CREATE EXTENSION needs the files on disk; availability is the honest test.
  SELECT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector')
    INTO has_vector;

  IF has_vector THEN
    CREATE EXTENSION IF NOT EXISTS vector;

    ALTER TABLE contact_preferences
      ADD COLUMN IF NOT EXISTS embedding vector(1024),
      ADD COLUMN IF NOT EXISTS embedded_text text,
      ADD COLUMN IF NOT EXISTS embedded_at timestamptz,
      ADD COLUMN IF NOT EXISTS embedding_model text;

    ALTER TABLE listings
      ADD COLUMN IF NOT EXISTS embedding vector(1024),
      ADD COLUMN IF NOT EXISTS embedded_text text,
      ADD COLUMN IF NOT EXISTS embedded_at timestamptz,
      ADD COLUMN IF NOT EXISTS embedding_model text;

    -- HNSW over cosine: the matcher compares direction, not magnitude, and Voyage
    -- returns normalised vectors. Built on the operator class that matches the
    -- query operator (<=>), or the planner ignores the index entirely.
    CREATE INDEX IF NOT EXISTS contact_preferences_embedding_idx
      ON contact_preferences USING hnsw (embedding vector_cosine_ops);
    CREATE INDEX IF NOT EXISTS listings_embedding_idx
      ON listings USING hnsw (embedding vector_cosine_ops);

    RAISE NOTICE 'pgvector present: embedding columns and HNSW indexes created.';
  ELSE
    /**
     * No extension. The TEXT columns still go in, because they are what makes the
     * gap recoverable: the embed job records WHAT it would have embedded and when,
     * so pointing this schema at a database that does have pgvector is a backfill
     * (pnpm ai:embed) rather than a re-derivation from scratch.
     */
    ALTER TABLE contact_preferences
      ADD COLUMN IF NOT EXISTS embedded_text text,
      ADD COLUMN IF NOT EXISTS embedded_at timestamptz,
      ADD COLUMN IF NOT EXISTS embedding_model text;

    ALTER TABLE listings
      ADD COLUMN IF NOT EXISTS embedded_text text,
      ADD COLUMN IF NOT EXISTS embedded_at timestamptz,
      ADD COLUMN IF NOT EXISTS embedding_model text;

    RAISE WARNING 'pgvector NOT available: embedding columns skipped. Stage 2 of the matcher will be unavailable until this database has the extension (see docs/backend-phases.md B5.1).';
  END IF;
END
$$;

--------------------------------------------------------------------------------
-- Matching runs need a record of themselves: which listing, when, how many
-- candidates survived each stage, and what it cost. Without this, "why did this
-- contact not match?" is unanswerable, and that question gets asked constantly.
--------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "match_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE restrict,
  "listing_id" uuid REFERENCES "listings"("id") ON DELETE cascade,
  "contact_id" uuid REFERENCES "contacts"("id") ON DELETE cascade,

  "stage1_count" integer NOT NULL DEFAULT 0,
  "stage2_count" integer NOT NULL DEFAULT 0,
  "stage3_count" integer NOT NULL DEFAULT 0,
  /** False when pgvector was absent, so a thin result set explains itself later. */
  "vector_stage_ran" boolean NOT NULL DEFAULT false,
  "ai_generation_id" uuid,
  "note" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),

  -- A run is about a listing or a contact, never both and never neither.
  CONSTRAINT "match_runs_one_subject" CHECK (
    ("listing_id" IS NULL) <> ("contact_id" IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS "match_runs_tenant_created_idx"
  ON "match_runs" ("tenant_id", "created_at" DESC);

ALTER TABLE "match_runs" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "match_runs";
CREATE POLICY tenant_isolation ON "match_runs"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON "match_runs" TO ozirealty_app;

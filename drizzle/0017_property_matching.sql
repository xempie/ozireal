--------------------------------------------------------------------------------
-- Matching works on PROPERTIES, listed or not (decided 2026-09-30).
--
-- A match used to be (listing, contact), so a property with no listing, typical of
-- an off-market deal, could not be matched at all. It is now (property, contact).
-- The listing stays on the row when there is one (it supplies the price range and
-- sale/rent, and the links and the campaign builder use it) but is optional.
--
-- Additive and data-preserving: property_id is backfilled from each row's listing
-- before it becomes required, and a property that somehow had two matched listings
-- keeps its best-scoring match for each contact.
--------------------------------------------------------------------------------

-- matches ---------------------------------------------------------------------

ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "property_id" uuid;

UPDATE "matches" m
   SET "property_id" = l."property_id"
  FROM "listings" l
 WHERE l."id" = m."listing_id" AND m."property_id" IS NULL;

-- One row per (property, contact): keep the best score where two listings of one
-- property matched the same person.
DELETE FROM "matches" m
 USING "matches" other
 WHERE m."property_id" = other."property_id"
   AND m."contact_id" = other."contact_id"
   AND (m."score", m."id") < (other."score", other."id");

ALTER TABLE "matches" ALTER COLUMN "property_id" SET NOT NULL;
ALTER TABLE "matches" ALTER COLUMN "listing_id" DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'matches_property_id_fk') THEN
    ALTER TABLE "matches"
      ADD CONSTRAINT "matches_property_id_fk"
      FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- The listing link is detail now; losing the listing must not lose the match.
ALTER TABLE "matches" DROP CONSTRAINT IF EXISTS "matches_listing_id_listings_id_fk";
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'matches_listing_id_fk') THEN
    ALTER TABLE "matches"
      ADD CONSTRAINT "matches_listing_id_fk"
      FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE SET NULL;
  END IF;
END $$;

DROP INDEX IF EXISTS "matches_uq";
CREATE UNIQUE INDEX IF NOT EXISTS "matches_property_contact_uq"
  ON "matches" ("property_id", "contact_id");
DROP INDEX IF EXISTS "matches_listing_score_idx";
CREATE INDEX IF NOT EXISTS "matches_property_score_idx"
  ON "matches" ("property_id", "score");

-- match_runs ------------------------------------------------------------------

ALTER TABLE "match_runs" ADD COLUMN IF NOT EXISTS "property_id" uuid;

UPDATE "match_runs" r
   SET "property_id" = l."property_id"
  FROM "listings" l
 WHERE l."id" = r."listing_id" AND r."property_id" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'match_runs_property_id_fk') THEN
    ALTER TABLE "match_runs"
      ADD CONSTRAINT "match_runs_property_id_fk"
      FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- A run is about a property or a contact, never both, never neither. The listing,
-- when there is one, is recorded alongside the property.
ALTER TABLE "match_runs" DROP CONSTRAINT IF EXISTS "match_runs_one_subject";
ALTER TABLE "match_runs" ADD CONSTRAINT "match_runs_one_subject" CHECK (
  ("property_id" IS NULL) <> ("contact_id" IS NULL)
);

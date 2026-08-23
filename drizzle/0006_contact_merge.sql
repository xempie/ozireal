--------------------------------------------------------------------------------
-- Merging two contact records.
--
-- The confirm queue has always had a "Merge into the older record" button. Wiring it
-- up exposed that there was nowhere for the answer to be written, so this adds one.
--
-- The obvious implementation - repoint every child row at the survivor and delete the
-- loser - is not available here, and that turns out to be the right constraint rather
-- than an obstacle. interactions and consents are append-only (migration 0001): their
-- contact_id cannot be updated, because a consent record is the evidence that a
-- particular person, on a particular form, at a particular moment, agreed to be
-- contacted. Rewriting which person it belonged to would destroy exactly the fact it
-- exists to prove.
--
-- So a merge here supersedes rather than rewrites. The newer record is tombstoned and
-- points at the survivor; the survivor's reads follow the pointer to pick up the
-- history. Nothing is destroyed, and the decision can be undone by a person who
-- decides it was wrong - which a row-rewrite merge never can be.
--------------------------------------------------------------------------------

ALTER TABLE "contacts"
  ADD COLUMN IF NOT EXISTS "merged_into_id" uuid REFERENCES "contacts"("id") ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS "contacts_merged_into_idx"
  ON "contacts" ("merged_into_id") WHERE "merged_into_id" IS NOT NULL;

-- A record cannot be merged into itself, and a merged record is a tombstoned one -
-- otherwise it would still appear in every list while its history lived elsewhere.
ALTER TABLE "contacts"
  DROP CONSTRAINT IF EXISTS "contacts_merge_is_consistent";
ALTER TABLE "contacts"
  ADD CONSTRAINT "contacts_merge_is_consistent" CHECK (
    "merged_into_id" IS NULL
    OR ("merged_into_id" <> "id" AND "tombstoned_at" IS NOT NULL)
  );

--------------------------------------------------------------------------------
-- Chains are refused.
--
-- If A merges into B and B later merges into C, then "follow the pointer" is no longer
-- one hop, and every read has to walk a list of unknown length. Worse, a cycle is
-- possible, and a query that follows one never returns. The merge action resolves to
-- the final survivor before writing, so the depth is always exactly one; this trigger
-- makes that a property of the data rather than of the code that happens to write it.
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION contacts_merge_no_chains() RETURNS trigger AS $$
DECLARE
  target_merged uuid;
BEGIN
  IF NEW.merged_into_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Un-merging is a decision, not an accident: allowed, but only from a set value to
  -- NULL, which this branch never sees.
  SELECT merged_into_id INTO target_merged FROM contacts WHERE id = NEW.merged_into_id;
  IF target_merged IS NOT NULL THEN
    RAISE EXCEPTION 'contacts: cannot merge into a record that is itself merged (id=%)', NEW.id
      USING HINT = 'Merge into the final surviving record instead.';
  END IF;

  IF EXISTS (SELECT 1 FROM contacts WHERE merged_into_id = NEW.id) THEN
    RAISE EXCEPTION 'contacts: % already has records merged into it and cannot itself be merged', NEW.id
      USING HINT = 'Merge those records into the new survivor first.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contacts_merge_no_chains_trg ON contacts;
CREATE TRIGGER contacts_merge_no_chains_trg
  BEFORE INSERT OR UPDATE OF merged_into_id ON contacts
  FOR EACH ROW EXECUTE FUNCTION contacts_merge_no_chains();

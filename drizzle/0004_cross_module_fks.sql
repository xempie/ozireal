-- Constraints Drizzle cannot express, because declaring them in TypeScript would
-- create a module cycle between the schema files.

--------------------------------------------------------------------------------
-- 1. interactions.listing_id was a bare uuid.
--
-- Interactions are the append-only evidence log and the only thing the AI reads when
-- building briefs (§4). A listing id that never existed, or one left behind after a
-- listing is removed, corrupts that log with nothing to detect it.
--------------------------------------------------------------------------------
ALTER TABLE interactions
  ADD CONSTRAINT interactions_listing_id_fk
  FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE RESTRICT;

--------------------------------------------------------------------------------
-- 2. Cost attribution pointers (rule 7 joins on these).
--------------------------------------------------------------------------------
ALTER TABLE matches
  ADD CONSTRAINT matches_ai_generation_fk
  FOREIGN KEY (ai_generation_id) REFERENCES ai_generations(id) ON DELETE SET NULL;

ALTER TABLE approval_items
  ADD CONSTRAINT approval_items_ai_generation_fk
  FOREIGN KEY (ai_generation_id) REFERENCES ai_generations(id) ON DELETE SET NULL;

ALTER TABLE campaign_recipients
  ADD CONSTRAINT campaign_recipients_approval_item_fk
  FOREIGN KEY (approval_item_id) REFERENCES approval_items(id) ON DELETE SET NULL;

ALTER TABLE confirm_items
  ADD CONSTRAINT confirm_items_voice_note_fk
  FOREIGN KEY (source_voice_note_id) REFERENCES voice_notes(id) ON DELETE SET NULL;

--------------------------------------------------------------------------------
-- 3. A tombstone cannot be reversed.
--
-- The original trigger compared a column tuple that omitted tombstoned_at in BOTH
-- directions, so an UPDATE could quietly set it back to NULL and un-delete a record
-- someone had exercised a privacy right over. It also left the primary key uncovered.
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION interactions_append_only() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'interactions is append-only: delete is not permitted (id=%)', OLD.id
      USING HINT = 'Set tombstoned_at instead, for a privacy request.';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'interactions: the primary key is immutable (id=%)', OLD.id;
  END IF;

  -- A tombstone is one-way: null -> timestamp only.
  IF OLD.tombstoned_at IS NOT NULL AND NEW.tombstoned_at IS DISTINCT FROM OLD.tombstoned_at THEN
    RAISE EXCEPTION 'interactions: a tombstone cannot be reversed or altered (id=%)', OLD.id
      USING HINT = 'A privacy deletion is final.';
  END IF;

  IF (NEW.tenant_id, NEW.contact_id, NEW.channel, NEW.direction, NEW.occurred_at,
      NEW.subject, NEW.body, NEW.raw_s3_key, NEW.thread_ref, NEW.message_id,
      NEW.listing_id, NEW.created_by_user_id, NEW.created_at)
     IS DISTINCT FROM
     (OLD.tenant_id, OLD.contact_id, OLD.channel, OLD.direction, OLD.occurred_at,
      OLD.subject, OLD.body, OLD.raw_s3_key, OLD.thread_ref, OLD.message_id,
      OLD.listing_id, OLD.created_by_user_id, OLD.created_at)
  THEN
    RAISE EXCEPTION 'interactions is append-only: only tombstoned_at may change (id=%)', OLD.id
      USING HINT = 'Record a correction as a NEW interaction row.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

--------------------------------------------------------------------------------
-- 4. A dispatched approval item cannot be deleted.
--
-- Constraints 6 in migration 0001 force a sent/blocked row to carry its evidence.
-- This stops that evidence being removed wholesale afterwards.
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION approval_items_keep_dispatched() RETURNS trigger AS $$
BEGIN
  IF OLD.status IN ('sent', 'blocked') THEN
    RAISE EXCEPTION 'approval_items: a % item is evidence and cannot be deleted (id=%)', OLD.status, OLD.id
      USING HINT = 'The record of what was sent, or refused at the consent gate, is kept.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER approval_items_keep_dispatched_trg
  BEFORE DELETE ON approval_items
  FOR EACH ROW EXECUTE FUNCTION approval_items_keep_dispatched();

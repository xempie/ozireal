--------------------------------------------------------------------------------
-- B4: a derived summary beside each interaction.
--
-- The extraction job (Haiku) writes a 1-2 sentence summary per interaction, and the
-- rolling-brief rebuild reads those instead of full bodies - a fraction of the
-- tokens over a long history. It is a CACHE of the evidence, not evidence itself:
-- the body stays immutable, and the append-only trigger below is re-stated to leave
-- ai_summary out of the frozen tuple, so re-summarisation (the nightly batch) can
-- overwrite it without weakening what append-only actually protects.
--------------------------------------------------------------------------------

ALTER TABLE "interactions"
  ADD COLUMN IF NOT EXISTS "ai_summary" text;

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

  -- Everything evidentiary is frozen. ai_summary is deliberately absent: it is
  -- derived FROM the frozen body, and a stale derivation must be replaceable.
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

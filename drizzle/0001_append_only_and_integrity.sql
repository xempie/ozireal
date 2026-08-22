-- Guards that belong in the database, not in application convention.

--------------------------------------------------------------------------------
-- 1. interactions is append-only.
--
-- CLAUDE.md §4: "Immutable; corrections are new rows. Never delete, only tombstone
-- for privacy requests." A convention that lives only in code is one refactor away
-- from being lost, so the database refuses the write itself. The single permitted
-- mutation is setting tombstoned_at for a privacy request.
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION interactions_append_only() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'interactions is append-only: delete is not permitted (id=%)', OLD.id
      USING HINT = 'Set tombstoned_at instead, for a privacy request.';
  END IF;

  -- Allow ONLY the tombstone transition. Every other column must be unchanged.
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

CREATE TRIGGER interactions_append_only_trg
  BEFORE UPDATE OR DELETE ON interactions
  FOR EACH ROW EXECUTE FUNCTION interactions_append_only();

--------------------------------------------------------------------------------
-- 2. consents are immutable too.
--
-- A revocation is a NEW row, so the history of what someone agreed to and when is
-- never rewritten. Without that, provenance cannot be produced if a send is
-- challenged (§4, §10).
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION consents_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'consents is append-only: record a new row instead (id=%)', OLD.id
    USING HINT = 'A revocation is a new consent row with status = revoked.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER consents_append_only_trg
  BEFORE UPDATE OR DELETE ON consents
  FOR EACH ROW EXECUTE FUNCTION consents_append_only();

--------------------------------------------------------------------------------
-- 3. A listing cannot be published without the wording a human authored.
--
-- Under-quoting provisions make the displayed price a legal artefact. This stops a
-- live listing existing with an empty or system-generated price (§16).
--------------------------------------------------------------------------------
ALTER TABLE listings ADD CONSTRAINT listings_live_needs_price_display
  CHECK (
    status NOT IN ('live', 'under_offer')
    OR (price_display IS NOT NULL AND length(trim(price_display)) > 0)
  );

--------------------------------------------------------------------------------
-- 4. A match must carry its reason.
--
-- §6: "The reason string is not optional." An agent will not act on a bare score.
--------------------------------------------------------------------------------
ALTER TABLE matches ADD CONSTRAINT matches_reason_not_blank
  CHECK (length(trim(reason)) > 0);

--------------------------------------------------------------------------------
-- 5. A merge review must compare two DIFFERENT contacts.
--------------------------------------------------------------------------------
ALTER TABLE merge_reviews ADD CONSTRAINT merge_reviews_distinct
  CHECK (contact_a_id <> contact_b_id);

--------------------------------------------------------------------------------
-- 6. Anything sent must record when, and anything blocked must say why.
--
-- Rule 1 and rule 2 depend on this trail being complete after the fact.
--------------------------------------------------------------------------------
ALTER TABLE approval_items ADD CONSTRAINT approval_sent_has_timestamp
  CHECK (status <> 'sent' OR sent_at IS NOT NULL);

ALTER TABLE approval_items ADD CONSTRAINT approval_blocked_has_reason
  CHECK (status <> 'blocked' OR (block_reason IS NOT NULL AND length(trim(block_reason)) > 0));

ALTER TABLE approval_items ADD CONSTRAINT approval_rejected_has_reason
  CHECK (status <> 'rejected' OR (reject_reason IS NOT NULL AND length(trim(reject_reason)) > 0));

--------------------------------------------------------------------------------
-- 7. Search price range must be coherent.
--------------------------------------------------------------------------------
ALTER TABLE listings ADD CONSTRAINT listings_price_range_sane
  CHECK (search_price_min IS NULL OR search_price_max IS NULL OR search_price_min <= search_price_max);

ALTER TABLE contact_preferences ADD CONSTRAINT preferences_price_range_sane
  CHECK (price_min IS NULL OR price_max IS NULL OR price_min <= price_max);

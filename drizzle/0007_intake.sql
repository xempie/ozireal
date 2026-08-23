--------------------------------------------------------------------------------
-- Intake (B3).
--
-- Two small pieces of schema that the pipeline needs to be safe rather than merely
-- functional: a key the public form authenticates with, and a uniqueness rule that
-- makes replayed deliveries harmless.
--------------------------------------------------------------------------------

-- The public form endpoint is addressed by key, not by tenant id. The id is guessable
-- (it appears in URLs and logs); this is a credential, rotated by writing a new one.
ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "form_key" uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS "tenants_form_key_uq" ON "tenants" ("form_key");

--------------------------------------------------------------------------------
-- At-least-once delivery is the contract everywhere upstream of us: SNS retries,
-- browsers resubmit, portals re-send digests. The pipeline therefore treats
-- (tenant, channel, message_id) as the identity of an inbound message and inserts
-- with ON CONFLICT DO NOTHING - the second delivery is not an error, it is the
-- transport doing its job. Partial, because hand-typed entries have no message id
-- and two phone calls are two interactions, not a replay.
--------------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS "interactions_replay_uq"
  ON "interactions" ("tenant_id", "channel", "message_id")
  WHERE "message_id" IS NOT NULL;

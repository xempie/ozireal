--------------------------------------------------------------------------------
-- A Developer role for contacts (owner's request, 2026-11-04). "Estate agent" needs no
-- change here: it is the existing `agent` value, relabelled in src/lib/roles.ts.
-- Additive; ADD VALUE is safe inside the deploy's transaction because nothing in this
-- migration uses the new value.
--------------------------------------------------------------------------------

ALTER TYPE "contact_role" ADD VALUE IF NOT EXISTS 'developer' AFTER 'investor';

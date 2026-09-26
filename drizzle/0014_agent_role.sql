--------------------------------------------------------------------------------
-- Agent: other real estate agents as contacts.
--
-- Conjunctional partners, buyer's agents, the agent on the other side of a deal.
-- A role like any other, so a person can be an agent AND a vendor over the years
-- (§4: person-centric, roles accumulate).
--
-- ADD VALUE is safe inside db-apply's single transaction on PostgreSQL 12+; the new
-- value just cannot be USED in the same transaction, and nothing here uses it.
-- IF NOT EXISTS makes a re-run a no-op.
--------------------------------------------------------------------------------

ALTER TYPE "contact_role" ADD VALUE IF NOT EXISTS 'agent';

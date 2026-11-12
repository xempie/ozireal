--------------------------------------------------------------------------------
-- Matched-buyer emails (owner's request, 2026-11-12). From the Matching board the
-- agent picks a property and the people to email; the AI drafts one personal email
-- each into the approval queue; the agent approves the batch; consent is re-checked
-- at the instant of each send (rules 1 and 2).
--
--   campaigns.property_id   the property a match campaign is about (off-market stock
--                           has no listing, so listing_id alone cannot carry it).
--   approval_items.review_note   why the AI thinks a draft deserves a look before it
--                           goes ("price not set", "weak match"). Null = nothing to flag.
--------------------------------------------------------------------------------

ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "property_id" uuid
  REFERENCES "properties"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "campaigns_property_idx" ON "campaigns" ("property_id");

ALTER TABLE "approval_items" ADD COLUMN IF NOT EXISTS "review_note" text;

--------------------------------------------------------------------------------
-- A second phone number and free-form tags on contacts (owner's request, 2026-11-04).
--
-- An imported list often carries both a mobile and a landline, and its own labels
-- ("VIP", "Open home Oct"). phone_e164 stays the one number identity resolution and
-- SMS use; secondary_phone is for calling only. Additive: nothing existing changes.
--------------------------------------------------------------------------------

ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "secondary_phone" text;
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "tags" text[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS "contacts_tags_idx" ON "contacts" USING gin ("tags");

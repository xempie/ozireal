--------------------------------------------------------------------------------
-- One "New listing" form (owner's request, 2026-11-05).
--
-- 1. Where a live listing shows on the website: 'advertised' (For Sale / For Rent,
--    All Listings, home page, suburb pages; the existing behaviour, so the default)
--    or 'new_homes' (a project card on /new-homes-adelaide). A New Homes listing is
--    a project, not an address: it carries a project name and is shown by suburb only.
-- 2. Contacts attached to a listing, each with their role on it (owner, interested
--    buyer, builder…). Internal only; never read by the public layer.
--
-- Additive. Existing listings become 'advertised', which is what they already are.
--------------------------------------------------------------------------------

ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "website_section" text NOT NULL DEFAULT 'advertised';
ALTER TABLE "listings" DROP CONSTRAINT IF EXISTS "listings_website_section_ck";
ALTER TABLE "listings" ADD CONSTRAINT "listings_website_section_ck"
  CHECK ("website_section" IN ('advertised', 'new_homes'));
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "project_name" text;
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "project_area" text;
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "project_ready" boolean NOT NULL DEFAULT false;
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "highlights" text[];

CREATE TABLE IF NOT EXISTS "listing_contacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
  "listing_id" uuid NOT NULL REFERENCES "listings"("id") ON DELETE CASCADE,
  "contact_id" uuid NOT NULL REFERENCES "contacts"("id") ON DELETE RESTRICT,
  "role" text NOT NULL CHECK ("role" IN
    ('owner', 'landlord', 'tenant', 'interested_buyer', 'builder_developer', 'estate_agent', 'other')),
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "listing_contacts_uq" ON "listing_contacts" ("listing_id", "contact_id", "role");
CREATE INDEX IF NOT EXISTS "listing_contacts_contact_idx" ON "listing_contacts" ("contact_id");

ALTER TABLE "listing_contacts" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "listing_contacts";
CREATE POLICY tenant_isolation ON "listing_contacts"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON "listing_contacts" TO ozirealty_app;

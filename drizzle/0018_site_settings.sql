--------------------------------------------------------------------------------
-- Website settings the agency controls from the console (Website section).
--
-- One jsonb document per tenant rather than a column per switch: the website
-- manager will grow (blocks, pages), and each new option should be a key, not a
-- migration. The shape is validated in src/server/actions/website.ts, and the
-- public site reads only the keys src/server/public/site.ts names (rule 8).
--
-- First key: homeListingFilters (boolean, default true when absent), the filter
-- tabs above "Currently advertised" on the home page.
--------------------------------------------------------------------------------

ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "site_settings" jsonb NOT NULL DEFAULT '{}'::jsonb;

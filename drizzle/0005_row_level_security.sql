-- Row-level security.
--
-- `forTenant()` in the application is a guard rail: it composes the tenant predicate
-- into a query, but only if the caller remembers to use it. RLS makes the DATABASE
-- enforce it, so a forgotten `where` returns NOTHING instead of every tenant's rows.
--
-- The policy reads `app.tenant_id`, which the connection sets per request. When the
-- setting is absent (a migration, a psql session, the seed) the policy denies rather
-- than allowing, so the safe direction is the default.
--
-- The seed and migrations run as the table OWNER, and RLS does not apply to owners
-- unless FORCE is set - which is exactly the exemption we want, rather than a bypass
-- role that application code could accidentally acquire.

CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS uuid AS $$
  SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

DO $$
DECLARE
  t text;
  -- Every table carrying tenant_id. suburbs and tenants are global by design, and
  -- drizzle's migration table is not ours to touch.
  tenant_tables text[] := ARRAY[
    'users','contacts','contact_roles','contact_preferences','contact_intent',
    'interactions','consents','merge_reviews','confirm_items','properties','listings',
    'listing_media','inspections','inspection_registrations','matches','campaigns',
    'campaign_recipients','approval_items','saved_views','proposals','tasks',
    'calendar_events','voice_notes','blog_posts','social_posts','seo_issues',
    'redirects','suburb_pages','ai_generations','audit_log','channel_adapters',
    'consent_templates','disclosure_rules'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format($f$
      CREATE POLICY tenant_isolation ON %I
        USING (tenant_id = current_tenant_id())
        WITH CHECK (tenant_id = current_tenant_id())
    $f$, t);
  END LOOP;
END $$;

-- contact_preference_suburbs has no tenant_id of its own; it inherits isolation from
-- the preference row it belongs to.
ALTER TABLE contact_preference_suburbs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON contact_preference_suburbs;
CREATE POLICY tenant_isolation ON contact_preference_suburbs
  USING (
    EXISTS (
      SELECT 1 FROM contact_preferences cp
      WHERE cp.id = contact_preference_suburbs.preference_id
        AND cp.tenant_id = current_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM contact_preferences cp
      WHERE cp.id = contact_preference_suburbs.preference_id
        AND cp.tenant_id = current_tenant_id()
    )
  );

-- The role the application connects as. It is NOT the owner, so RLS applies to it.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ozirealty_app') THEN
    CREATE ROLE ozirealty_app LOGIN PASSWORD 'dev-only-not-for-production';
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO ozirealty_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ozirealty_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ozirealty_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ozirealty_app;

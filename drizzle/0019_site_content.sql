--------------------------------------------------------------------------------
-- Website content edited from the console (and the assistant): text overrides and
-- added blocks on built-in pages, whole new pages, and the theme.
--
-- Versioned rather than updated in place: one row per path per version. At most one
-- 'draft' and one 'published' row per path; publishing archives the old published
-- row, so History can restore any earlier version. The doc shape is validated by
-- src/lib/site-content.ts before it is written, and the public site reads it only
-- through src/server/public/content.ts (rule 8).
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "site_content" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
  "path" text NOT NULL,
  "version" integer NOT NULL,
  "status" text NOT NULL CHECK ("status" IN ('draft', 'published', 'archived')),
  "doc" jsonb NOT NULL,
  "note" text,
  "created_by" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "published_at" timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS "site_content_version_uq"
  ON "site_content" ("tenant_id", "path", "version");
CREATE UNIQUE INDEX IF NOT EXISTS "site_content_one_draft_uq"
  ON "site_content" ("tenant_id", "path") WHERE "status" = 'draft';
CREATE UNIQUE INDEX IF NOT EXISTS "site_content_one_published_uq"
  ON "site_content" ("tenant_id", "path") WHERE "status" = 'published';

ALTER TABLE "site_content" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "site_content";
CREATE POLICY tenant_isolation ON "site_content"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON "site_content" TO ozirealty_app;

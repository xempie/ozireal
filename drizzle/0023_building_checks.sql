--------------------------------------------------------------------------------
-- Building checks (owner's request, 2026-11-11): the "building-check" skill as a CRM
-- feature. Photos in, a Red / Amber / Green condition read out, saved and re-runnable.
--
-- A check may belong to a property the agency holds, or to none (a buyer's shortlist
-- home). Photos are PRIVATE: stored under t/<tenant>/c/<check>/..., a prefix the public
-- /media route refuses, and served only to signed-in staff. The model's output is kept
-- as validated JSON (runTask + Zod), never written onto a contact or property (rule 5).
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "building_checks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
  "property_id" uuid REFERENCES "properties"("id") ON DELETE SET NULL,
  "label" text,
  "context" text NOT NULL CHECK ("context" IN ('buyer', 'pre_listing', 'property_management')),
  "notes" text,
  -- [{ "key": "t/../c/../<uuid>.jpg", "area": "roof" | null, "name": "IMG_1234.jpg" }]
  "photos" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "status" text NOT NULL DEFAULT 'queued' CHECK ("status" IN ('queued', 'running', 'done', 'failed')),
  "result" jsonb,
  "error" text,
  "ai_generation_id" uuid,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "completed_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "building_checks_property_idx" ON "building_checks" ("property_id");
CREATE INDEX IF NOT EXISTS "building_checks_tenant_created_idx" ON "building_checks" ("tenant_id", "created_at" DESC);

ALTER TABLE "building_checks" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "building_checks";
CREATE POLICY tenant_isolation ON "building_checks"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON "building_checks" TO ozirealty_app;

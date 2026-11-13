--------------------------------------------------------------------------------
-- AI audience finder (owner's request, 2026-11-13). Only 5 of 325 contacts had
-- structured preferences, so preference matching left most stock with nobody. The
-- finder reads every emailable client's roles, tags, enquiries and history and picks
-- the people a property genuinely suits, writing the picks into `matches` (with a
-- specific reason). One row here per run, so the screen can show progress.
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "audience_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
  "property_id" uuid NOT NULL REFERENCES "properties"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'queued' CHECK ("status" IN ('queued','running','done','failed')),
  "considered" integer NOT NULL DEFAULT 0,
  "picked" integer NOT NULL DEFAULT 0,
  "error" text,
  "ai_generation_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "completed_at" timestamptz
);
CREATE INDEX IF NOT EXISTS "audience_runs_property_idx" ON "audience_runs" ("property_id", "created_at" DESC);

ALTER TABLE "audience_runs" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON "audience_runs";
CREATE POLICY "tenant_isolation" ON "audience_runs"
  USING ("tenant_id" = current_tenant_id())
  WITH CHECK ("tenant_id" = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON "audience_runs" TO ozirealty_app;

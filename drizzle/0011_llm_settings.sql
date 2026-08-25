--------------------------------------------------------------------------------
-- LLM configuration, per tenant, in the console.
--
-- Model ids, temperatures, token ceilings and the monthly spend cap were spread
-- across four call sites, two environment variables and a hardcoded pricing
-- table. Every one of them is a decision the agency should be able to make and
-- see, and none of them should need a deploy.
--
-- The spend cap is the one that earns its place fastest. RoniDoc meters every
-- call and refuses BEFORE doing the work rather than discovering the bill later
-- (../aipa: checkLimits() returns 429 before any AI runs); that pattern is
-- ported here, reading the ai_generations ledger B4 already writes.
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "llm_settings" (
  "tenant_id" uuid PRIMARY KEY REFERENCES "tenants"("id") ON DELETE restrict,

  /**
   * Two tiers, named for the JOB rather than the vendor's product: extraction and
   * classification go to the fast model, anything a person reads goes to the
   * writing model. Free text, because a new model must be usable the day it ships
   * without waiting for us to redeploy.
   */
  "fast_model" text NOT NULL DEFAULT 'claude-haiku-4-5',
  "writing_model" text NOT NULL DEFAULT 'claude-sonnet-5',

  /**
   * Temperature is split by whether the output is PARSED or READ.
   *
   * Structured tasks are pinned at 0 and the column refuses anything else: every
   * one of them prompts for JSON and hands the result to Zod, and a creative
   * temperature there does not produce nicer data, it produces a failed job and a
   * wasted call. Prose has real latitude, so it is configurable within a band.
   */
  "structured_temperature" real NOT NULL DEFAULT 0,
  "prose_temperature" real NOT NULL DEFAULT 0.3,

  "extraction_max_tokens" integer NOT NULL DEFAULT 1200,
  "brief_max_tokens" integer NOT NULL DEFAULT 1000,
  "ranking_max_tokens" integer NOT NULL DEFAULT 2000,

  /** Null means no cap. Zero would mean "never spend", which is a real choice. */
  "monthly_budget_aud" numeric(10, 2),
  /**
   * What happens at the cap. 'block' refuses new AI work and lets the product
   * carry on without it — intake still lands, briefs just stop refreshing.
   * 'warn' only surfaces a banner, for an agency that would rather overspend
   * than lose a day of summaries.
   */
  "budget_action" text NOT NULL DEFAULT 'block',

  /** Pricing is per-model and moves; holding it here means a correction is an
   *  edit rather than a deploy. Cost is still computed AT CALL TIME and frozen
   *  onto the ledger row, so a later correction never rewrites history. */
  "fast_input_usd_per_mtok" numeric(10, 4) NOT NULL DEFAULT 1.00,
  "fast_output_usd_per_mtok" numeric(10, 4) NOT NULL DEFAULT 5.00,
  "writing_input_usd_per_mtok" numeric(10, 4) NOT NULL DEFAULT 2.00,
  "writing_output_usd_per_mtok" numeric(10, 4) NOT NULL DEFAULT 10.00,
  "aud_per_usd" numeric(10, 4) NOT NULL DEFAULT 1.55,

  "updated_by_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "updated_at" timestamptz NOT NULL DEFAULT now(),

  -- Structured output is parsed by a machine. There is no setting for "be creative
  -- with the JSON", so the database refuses to store one.
  CONSTRAINT "llm_structured_temperature_is_zero" CHECK ("structured_temperature" = 0),
  CONSTRAINT "llm_prose_temperature_range" CHECK ("prose_temperature" BETWEEN 0 AND 1),
  CONSTRAINT "llm_budget_action_known" CHECK ("budget_action" IN ('block', 'warn')),
  CONSTRAINT "llm_budget_not_negative" CHECK ("monthly_budget_aud" IS NULL OR "monthly_budget_aud" >= 0),
  CONSTRAINT "llm_token_ceilings_sane" CHECK (
    "extraction_max_tokens" BETWEEN 256 AND 32000
    AND "brief_max_tokens" BETWEEN 256 AND 32000
    AND "ranking_max_tokens" BETWEEN 256 AND 32000
  ),
  CONSTRAINT "llm_models_not_blank" CHECK (
    length(btrim("fast_model")) > 0 AND length(btrim("writing_model")) > 0
  )
);

ALTER TABLE "llm_settings" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "llm_settings";
CREATE POLICY tenant_isolation ON "llm_settings"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());
GRANT SELECT, INSERT, UPDATE, DELETE ON "llm_settings" TO ozirealty_app;

-- Every existing tenant gets the defaults, so a read never has to cope with a
-- missing row on a database that has been running since B1.
INSERT INTO "llm_settings" ("tenant_id")
SELECT id FROM "tenants"
ON CONFLICT ("tenant_id") DO NOTHING;

-- The budget check runs before every AI call, so the month-to-date sum has to be
-- cheap. This is the index that makes it so.
CREATE INDEX IF NOT EXISTS "ai_generations_tenant_month_idx"
  ON "ai_generations" ("tenant_id", "created_at");

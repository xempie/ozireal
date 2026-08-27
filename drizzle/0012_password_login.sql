--------------------------------------------------------------------------------
-- Password sign-in.
--
-- B2 shipped Google/Entra plus a passwordless DEVELOPMENT login that
-- src/auth.ts refuses whenever NODE_ENV is production. That refusal is correct
-- and stays: a login that takes an email and no secret is an open door on a
-- public URL, and the CRM behind it holds client contact details, consent
-- records and everything an agency knows about a person.
--
-- So production gets a real password instead of a relaxed guard.
--
-- scrypt, from node:crypto — deliberately slow and memory-hard, so a stolen
-- hash resists offline cracking. The salt is per-user and stored alongside;
-- the parameters are stored too, so raising the cost later does not invalidate
-- existing hashes.
--------------------------------------------------------------------------------

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "password_hash" text,
  ADD COLUMN IF NOT EXISTS "password_set_at" timestamptz,
  /** Counts consecutive failures; cleared on success. Throttling lives in the
   *  database rather than in memory so it survives a restart — otherwise a
   *  restart is a free reset for whoever is guessing. */
  ADD COLUMN IF NOT EXISTS "failed_logins" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "locked_until" timestamptz;

COMMENT ON COLUMN "users"."password_hash" IS
  'scrypt: N$r$p$salt$hash, all base64. Never a bare digest.';

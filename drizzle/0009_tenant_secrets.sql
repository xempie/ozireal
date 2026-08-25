--------------------------------------------------------------------------------
-- Credentials the agency enters for itself, rather than in a file on the server.
--
-- Stored ENCRYPTED. A provider key in a database column is a key that leaks with a
-- backup dump, a stray SELECT, or a screenshot of a support session — so the column
-- holds AES-256-GCM ciphertext and the plaintext exists only in memory, for the
-- length of one API call.
--
-- The encryption key itself stays in the environment (SECRETS_KEY, or AUTH_SECRET).
-- That is not a dodge: you cannot encrypt your way to zero secrets on disk, you can
-- only reduce them to ONE, held somewhere the database dump is not. That is the
-- whole gain, and it is a real one.
--
-- `last_four` is stored in the clear on purpose: the screen has to show WHICH key is
-- configured without ever decrypting, and four characters identify a key to the
-- person who owns it while being useless to anyone else.
--------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "tenant_secrets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE restrict,

  /** Logical name, e.g. 'ANTHROPIC_API_KEY'. One row per name per tenant. */
  "name" text NOT NULL,

  "ciphertext" text NOT NULL,
  "iv" text NOT NULL,
  "auth_tag" text NOT NULL,
  /** Which key version encrypted this, so rotation can re-wrap rather than guess. */
  "key_version" integer NOT NULL DEFAULT 1,

  "last_four" text NOT NULL,
  "updated_by_user_id" uuid REFERENCES "users"("id") ON DELETE set null,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_secrets_uq" ON "tenant_secrets" ("tenant_id", "name");

-- Same isolation as every other tenant-scoped table (migration 0005's pattern).
ALTER TABLE "tenant_secrets" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "tenant_secrets";
CREATE POLICY tenant_isolation ON "tenant_secrets"
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON "tenant_secrets" TO ozirealty_app;

--------------------------------------------------------------------------------
-- A secret is write-only from the application's point of view: it may be replaced
-- or removed, but the ciphertext of an existing row may never be read back OUT
-- through an UPDATE that widens access. There is no trigger that can enforce
-- "never SELECT this", so the protection is structural instead: the query layer
-- exposes exactly two functions (one that returns last_four, one that decrypts for
-- a single call) and neither is reachable from a React component.
--------------------------------------------------------------------------------
COMMENT ON TABLE "tenant_secrets" IS
  'Encrypted provider credentials. Never select ciphertext into anything that reaches a client component.';

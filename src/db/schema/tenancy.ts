import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  real,
  numeric,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Tenancy and identity.
 *
 * Launch is one office and one user (decision D1), so there is no tenant management
 * UI, no invites and no membership table. But `tenant_id` is on every tenant-scoped
 * table from day one and every query goes through the scoped client, because the
 * column costs nothing now and is effectively unaddable later.
 */

export const userRole = pgEnum("user_role", ["principal", "agent", "admin"]);
export const authProvider = pgEnum("auth_provider", ["google", "entra", "local"]);

export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  tradingName: text("trading_name"),
  abn: text("abn"),
  licenceNumber: text("licence_number"),
  /**
   * Drives which disclosure rules and which slice of the legal corpus apply. Seeded
   * with SA alone (D2) - but never hardcoded in application logic, because that is
   * exactly what would turn "add NSW" into a rewrite rather than a data load.
   */
  jurisdiction: text("jurisdiction").notNull().default("SA"),
  timezone: text("timezone").notNull().default("Australia/Adelaide"),
  /**
   * What the public enquiry form authenticates with. The tenant id itself is not a
   * secret - it appears in URLs and logs - so the endpoint is addressed by this
   * instead, and rotating it is writing a new value rather than re-keying the tenant.
   */
  formKey: uuid("form_key").notNull().defaultRandom().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    role: userRole("role").notNull().default("agent"),
    provider: authProvider("provider").notNull().default("google"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),

    /** Password sign-in (migration 0012). scrypt, never a bare digest. */
    passwordHash: text("password_hash"),
    passwordSetAt: timestamp("password_set_at", { withTimezone: true }),
    /** Throttling lives in the database so a restart is not a free reset for
     *  whoever is guessing. */
    failedLogins: integer("failed_logins").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("users_tenant_idx").on(t.tenantId)],
);

/**
 * Provider credentials the agency enters in Settings (migration 0009).
 *
 * AES-256-GCM ciphertext; the wrapping key stays in the environment. `lastFour` is
 * clear text on purpose — the screen must show WHICH key is set without decrypting,
 * and four characters identify a key to its owner while being useless to anyone else.
 */
export const tenantSecrets = pgTable(
  "tenant_secrets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    name: text("name").notNull(),

    ciphertext: text("ciphertext").notNull(),
    iv: text("iv").notNull(),
    authTag: text("auth_tag").notNull(),
    keyVersion: integer("key_version").notNull().default(1),

    lastFour: text("last_four").notNull(),
    updatedByUserId: uuid("updated_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("tenant_secrets_uq").on(t.tenantId, t.name)],
);

/**
 * LLM configuration, one row per tenant (migration 0011).
 *
 * Model ids, temperatures, token ceilings, pricing and the monthly spend cap —
 * every decision the agency should be able to see and change without a deploy.
 * The structured temperature is pinned to 0 by a CHECK constraint: those tasks
 * are parsed by Zod, and there is no such thing as a creative JSON schema.
 */
export const llmSettings = pgTable("llm_settings", {
  tenantId: uuid("tenant_id")
    .primaryKey()
    .references(() => tenants.id, { onDelete: "restrict" }),

  fastModel: text("fast_model").notNull().default("claude-haiku-4-5"),
  writingModel: text("writing_model").notNull().default("claude-sonnet-5"),

  structuredTemperature: real("structured_temperature").notNull().default(0),
  proseTemperature: real("prose_temperature").notNull().default(0.3),

  extractionMaxTokens: integer("extraction_max_tokens").notNull().default(1200),
  briefMaxTokens: integer("brief_max_tokens").notNull().default(1000),
  rankingMaxTokens: integer("ranking_max_tokens").notNull().default(2000),
  /** Drafting an SMS (migration 0013). Small on purpose: a max_tokens stop is a
   *  non-retryable failure that has already been billed, so the ceiling should fit
   *  the task rather than be borrowed from a bigger one. */
  draftMaxTokens: integer("draft_max_tokens").notNull().default(400),

  monthlyBudgetAud: numeric("monthly_budget_aud", { precision: 10, scale: 2 }),
  budgetAction: text("budget_action").notNull().default("block"),

  fastInputUsdPerMtok: numeric("fast_input_usd_per_mtok", { precision: 10, scale: 4 })
    .notNull()
    .default("1.00"),
  fastOutputUsdPerMtok: numeric("fast_output_usd_per_mtok", { precision: 10, scale: 4 })
    .notNull()
    .default("5.00"),
  writingInputUsdPerMtok: numeric("writing_input_usd_per_mtok", { precision: 10, scale: 4 })
    .notNull()
    .default("2.00"),
  writingOutputUsdPerMtok: numeric("writing_output_usd_per_mtok", { precision: 10, scale: 4 })
    .notNull()
    .default("10.00"),
  audPerUsd: numeric("aud_per_usd", { precision: 10, scale: 4 }).notNull().default("1.55"),

  updatedByUserId: uuid("updated_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

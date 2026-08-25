import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
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

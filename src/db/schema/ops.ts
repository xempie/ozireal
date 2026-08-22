import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  numeric,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { tenants, users } from "./tenancy";
import { contacts, interactions } from "./contacts";
import { listings } from "./stock";

/**
 * The assistant layer, content surfaces, and operations.
 */

/* ------------------------------------------------------- assistant layer */

export const taskStatus = pgEnum("task_status", ["open", "done", "cancelled"]);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    contactId: uuid("contact_id").references(() => contacts.id, {
      onDelete: "cascade",
    }),
    listingId: uuid("listing_id").references(() => listings.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }),
    status: taskStatus("status").notNull().default("open"),
    /** What produced it - usually a voice note or an email, via the confirm queue. */
    sourceInteractionId: uuid("source_interaction_id").references(
      () => interactions.id,
      { onDelete: "set null" },
    ),
    sourceLabel: text("source_label"),
    assignedToUserId: uuid("assigned_to_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("tasks_tenant_status_due_idx").on(t.tenantId, t.status, t.dueAt),
    index("tasks_contact_idx").on(t.contactId),
  ],
);

export const calendarProvider = pgEnum("calendar_provider", [
  "google",
  "outlook",
  "ozirealty",
]);
export const calendarKind = pgEnum("calendar_kind", [
  "inspection",
  "appraisal",
  "meeting",
  "settlement",
  "personal",
]);

export const calendarEvents = pgTable(
  "calendar_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),

    provider: calendarProvider("provider").notNull(),
    /** The event id in Google or Graph, so we recognise our own writes on the way back. */
    externalId: text("external_id"),
    /**
     * Whether WE created it. The external calendar stays the source of truth for
     * anything it owns: we never edit or delete an event we did not create.
     */
    ourWrite: boolean("our_write").notNull().default(false),

    title: text("title").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    kind: calendarKind("kind"),

    contactId: uuid("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    listingId: uuid("listing_id").references(() => listings.id, {
      onDelete: "set null",
    }),

    /** Incremental sync only - never a scheduled full re-list. */
    syncToken: text("sync_token"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("calendar_events_external_uq").on(t.provider, t.externalId),
    index("calendar_events_tenant_start_idx").on(t.tenantId, t.startsAt),
  ],
);

export const voiceStatus = pgEnum("voice_status", [
  "uploaded",
  "processing",
  "transcribed",
  "confirmed",
  "failed",
]);

export const voiceNotes = pgTable(
  "voice_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    contactId: uuid("contact_id").references(() => contacts.id, {
      onDelete: "set null",
    }),
    s3Key: text("s3_key").notNull(),
    durationSeconds: integer("duration_seconds"),
    transcript: text("transcript"),
    transcribedAt: timestamp("transcribed_at", { withTimezone: true }),
    status: voiceStatus("status").notNull().default("uploaded"),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("voice_notes_tenant_idx").on(t.tenantId, t.recordedAt)],
);

/* --------------------------------------------------------- content & site */

export const publishStatus = pgEnum("publish_status", [
  "draft",
  "in_approval",
  "published",
  "archived",
]);

export const blogPosts = pgTable(
  "blog_posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    status: publishStatus("status").notNull().default("draft"),
    wordCount: integer("word_count"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    /** Rollup, refreshed by a job - same reasoning as listings.views7d. */
    views30d: integer("views_30d").notNull().default(0),
    /** The original Wix address, kept so the redirect map stays verifiable. */
    legacyUrl: text("legacy_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("blog_posts_slug_uq").on(t.tenantId, t.slug)],
);

export const socialNetwork = pgEnum("social_network", [
  "instagram",
  "facebook",
  "linkedin",
]);

export const socialPosts = pgTable(
  "social_posts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    network: socialNetwork("network").notNull(),
    status: publishStatus("status").notNull().default("draft"),
    body: text("body").notNull(),
    listingId: uuid("listing_id").references(() => listings.id, {
      onDelete: "set null",
    }),
    engagement: integer("engagement").notNull().default(0),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("social_posts_tenant_status_idx").on(t.tenantId, t.status)],
);

export const seoSeverity = pgEnum("seo_severity", ["critical", "warning", "info"]);
export const seoIssueStatus = pgEnum("seo_issue_status", [
  "open",
  "accepted",
  "dismissed",
  "resolved",
]);

/** The SEO agent proposes; a human applies. There is no deploy path from this table. */
export const seoIssues = pgTable(
  "seo_issues",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    severity: seoSeverity("severity").notNull(),
    title: text("title").notNull(),
    detail: text("detail").notNull(),
    proposal: text("proposal").notNull(),
    affectedCount: integer("affected_count").notNull().default(0),
    status: seoIssueStatus("status").notNull().default("open"),
    crawledAt: timestamp("crawled_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("seo_issues_tenant_status_idx").on(t.tenantId, t.status)],
);

export const redirectStatus = pgEnum("redirect_status", [
  "mapped",
  "undecided",
  "blocked",
]);

/** The Wix cutover map. Every legacy URL needs a destination before the switch. */
export const redirects = pgTable(
  "redirects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    fromPath: text("from_path").notNull(),
    toPath: text("to_path"),
    status: redirectStatus("status").notNull().default("undecided"),
    note: text("note"),
  },
  (t) => [uniqueIndex("redirects_from_uq").on(t.tenantId, t.fromPath)],
);

export const suburbPages = pgTable(
  "suburb_pages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    suburbName: text("suburb_name").notNull(),
    marketCopy: text("market_copy"),
    status: publishStatus("status").notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("suburb_pages_uq").on(t.tenantId, t.suburbName)],
);

/* ---------------------------------------------------------------- ops */

/**
 * Every AI generation, logged. Model, prompt hash, tokens, cost, latency and the
 * record it relates to. Per-tenant cost visibility is a launch requirement, not a
 * later addition (rule 7).
 */
export const aiGenerations = pgTable(
  "ai_generations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),

    task: text("task").notNull(),
    model: text("model").notNull(),
    /** So a change in instructions is traceable without storing the prompt itself. */
    promptHash: text("prompt_hash"),

    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    cachedInputTokens: integer("cached_input_tokens").notNull().default(0),
    costAud: numeric("cost_aud", { precision: 10, scale: 6 }).notNull().default("0"),
    latencyMs: integer("latency_ms"),

    /** What caused the spend, so cost can be attributed to a record not just a day. */
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),

    succeeded: boolean("succeeded").notNull().default(true),
    /** Kept on schema-validation failure - you need it for prompt tuning (§9). */
    rawResponse: text("raw_response"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ai_generations_tenant_created_idx").on(t.tenantId, t.createdAt),
    index("ai_generations_task_idx").on(t.tenantId, t.task),
    index("ai_generations_entity_idx").on(t.entityType, t.entityId),
  ],
);

export const auditKind = pgEnum("audit_kind", [
  "approve",
  "reject",
  "edit",
  "merge",
  "publish",
  "commit",
  "login",
  "block",
]);

/**
 * What a person did to the system. Distinct from the interaction log, which records
 * what happened with a contact - the two answer different questions when something is
 * disputed months later. The actor may be "system", e.g. a send refused at the gate.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    actorLabel: text("actor_label").notNull(),
    kind: auditKind("kind").notNull(),
    action: text("action").notNull(),
    target: text("target").notNull(),
    entityType: text("entity_type"),
    entityId: uuid("entity_id"),
    metadata: jsonb("metadata"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_log_tenant_time_idx").on(t.tenantId, t.occurredAt)],
);

export const adapterStatus = pgEnum("adapter_status", ["ok", "degraded", "down"]);

/** Health of each channel adapter, so a silently dead inbox is visible. */
export const channelAdapters = pgTable(
  "channel_adapters",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    status: adapterStatus("status").notNull().default("ok"),
    lastReceivedAt: timestamp("last_received_at", { withTimezone: true }),
    receivedToday: integer("received_today").notNull().default(0),
  },
  (t) => [uniqueIndex("channel_adapters_uq").on(t.tenantId, t.name)],
);

/** Per-form consent wording. Changing a template must not rewrite history, which is
 *  why consents.wording_shown stores the text rather than pointing here. */
export const consentTemplates = pgTable(
  "consent_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    formName: text("form_name").notNull(),
    wording: text("wording").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("consent_templates_uq").on(t.tenantId, t.formName)],
);

/** Per-jurisdiction disclosure obligations. Seeded with SA; never hardcoded (§10). */
export const disclosureRules = pgTable(
  "disclosure_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    jurisdiction: text("jurisdiction").notNull(),
    name: text("name").notNull(),
    detail: text("detail").notNull(),
  },
  (t) => [uniqueIndex("disclosure_rules_uq").on(t.tenantId, t.jurisdiction, t.name)],
);

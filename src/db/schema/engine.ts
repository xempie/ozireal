import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  real,
  numeric,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
  boolean,
} from "drizzle-orm/pg-core";
import { tenants, users } from "./tenancy";
import { contacts, consentStatus } from "./contacts";
import { listings, properties } from "./stock";

/**
 * Matching, campaigns and the approval queue.
 *
 * The approval queue is the single door every outbound message leaves through. There
 * is no autonomous send path and no setting that creates one (rule 1), and consent is
 * re-checked at the instant of sending rather than at draft time (rule 2).
 */

export const matchStage = pgEnum("match_stage", ["filter", "vector", "ranked"]);

export const matches = pgTable(
  "matches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),

    score: real("score").notNull(),
    /**
     * One sentence, never blank. An agent will not act on a bare score, and the reason
     * is what makes this feature used daily rather than ignored after a week (§6).
     */
    reason: text("reason").notNull(),
    stage: matchStage("stage").notNull(),

    aiGenerationId: uuid("ai_generation_id"),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("matches_uq").on(t.listingId, t.contactId),
    index("matches_listing_score_idx").on(t.listingId, t.score),
    index("matches_contact_score_idx").on(t.contactId, t.score),
  ],
);

export const campaignStatus = pgEnum("campaign_status", [
  "draft",
  "in_approval",
  "sending",
  "sent",
  "cancelled",
]);
export const campaignChannel = pgEnum("campaign_channel", ["email", "sms"]);

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    listingId: uuid("listing_id").references(() => listings.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    channel: campaignChannel("channel").notNull(),
    status: campaignStatus("status").notNull().default("draft"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [index("campaigns_tenant_status_idx").on(t.tenantId, t.status)],
);

/**
 * One row per person a campaign reaches. The console shows recipients / approved /
 * blocked / opened / replied; those are COUNTS over this table rather than stored
 * aggregates, so they cannot drift from what actually happened.
 */
export const campaignRecipients = pgTable(
  "campaign_recipients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "restrict" }),
    approvalItemId: uuid("approval_item_id"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    repliedAt: timestamp("replied_at", { withTimezone: true }),
    blockedReason: text("blocked_reason"),
  },
  (t) => [
    uniqueIndex("campaign_recipients_uq").on(t.campaignId, t.contactId),
    index("campaign_recipients_tenant_idx").on(t.tenantId),
  ],
);

export const approvalKind = pgEnum("approval_kind", [
  "email",
  "sms",
  "social",
  "article",
  "proposal",
  "digest",
]);

export const approvalStatus = pgEnum("approval_status", [
  "pending",
  "approved",
  "sent",
  "blocked",
  "rejected",
]);

export const approvalItems = pgTable(
  "approval_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),

    kind: approvalKind("kind").notNull(),
    status: approvalStatus("status").notNull().default("pending"),

    /**
     * restrict, not cascade. This row IS the evidence that a message was approved,
     * sent, or refused at the consent gate - deleting a contact or a draft campaign
     * must not quietly destroy it. The same reasoning already governs
     * interactions.contact_id.
     */
    contactId: uuid("contact_id").references(() => contacts.id, {
      onDelete: "restrict",
    }),
    listingId: uuid("listing_id").references(() => listings.id, {
      onDelete: "set null",
    }),
    campaignId: uuid("campaign_id").references(() => campaigns.id, {
      onDelete: "set null",
    }),

    draftSubject: text("draft_subject"),
    draftBody: text("draft_body").notNull(),
    /** Kept when a human edits before approving, so the audit shows what changed. */
    originalBody: text("original_body"),

    /**
     * Consent as it stood when the draft was written, and as it stands now. Holding
     * both is what makes "changed since drafting" visible on screen rather than a
     * silent difference.
     */
    consentAtDraft: consentStatus("consent_at_draft"),
    consentCheckedAt: timestamp("consent_checked_at", { withTimezone: true }),

    reviewedByUserId: uuid("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    rejectReason: text("reject_reason"),

    sentAt: timestamp("sent_at", { withTimezone: true }),
    /** Why a send was refused at the gate. Populated by the system, not a person. */
    blockReason: text("block_reason"),
    providerMessageId: text("provider_message_id"),

    model: text("model"),
    costAud: numeric("cost_aud", { precision: 10, scale: 4 }),
    aiGenerationId: uuid("ai_generation_id"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("approval_items_tenant_status_idx").on(t.tenantId, t.status),
    index("approval_items_contact_idx").on(t.contactId),
    index("approval_items_campaign_idx").on(t.campaignId),
  ],
);

/** Saved filters over contacts. A stored query, never a copy of the rows. */
export const savedViews = pgTable(
  "saved_views",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    description: text("description"),
    filter: jsonb("filter").notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("saved_views_uq").on(t.tenantId, t.name)],
);

export const proposalStatus = pgEnum("proposal_status", [
  "draft",
  "in_approval",
  "sent",
  "won",
  "lost",
]);

export const proposals = pgTable(
  "proposals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    propertyId: uuid("property_id").references(() => properties.id, {
      onDelete: "restrict",
    }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "restrict" }),
    status: proposalStatus("status").notNull().default("draft"),
    /** A range, never a single number, and never a figure the agent has not signed off. */
    estimateLow: integer("estimate_low"),
    estimateHigh: integer("estimate_high"),
    comparables: integer("comparables"),
    pages: integer("pages"),
    pdfS3Key: text("pdf_s3_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("proposals_tenant_status_idx").on(t.tenantId, t.status)],
);

/**
 * A record of each matching run (migration 0010).
 *
 * "Why did this contact not match?" gets asked constantly, and without the funnel
 * counts it is unanswerable. `vectorStageRan` is the load-bearing one: it tells a
 * later reader whether a thin result set was the data or a missing extension.
 */
export const matchRuns = pgTable(
  "match_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    listingId: uuid("listing_id").references(() => listings.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "cascade" }),

    stage1Count: integer("stage1_count").notNull().default(0),
    stage2Count: integer("stage2_count").notNull().default(0),
    stage3Count: integer("stage3_count").notNull().default(0),
    vectorStageRan: boolean("vector_stage_ran").notNull().default(false),
    aiGenerationId: uuid("ai_generation_id"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("match_runs_tenant_created_idx").on(t.tenantId, t.createdAt)],
);

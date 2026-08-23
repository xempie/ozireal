import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  real,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
  date,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants, users } from "./tenancy";
import { propertyType as propertyTypeEnum, suburbs } from "./shared";

/**
 * The people side. Person-centric, never deal-centric: one person accumulates roles
 * over the years rather than spawning a new record per transaction (CLAUDE.md §4).
 */

export const contactRole = pgEnum("contact_role", [
  "buyer",
  "vendor",
  "landlord",
  "tenant",
  "referrer",
  "investor",
  "business_vendor",
]);

export const channel = pgEnum("channel", [
  "web_form",
  "email",
  "sms",
  "social",
  "phone",
  "voice_note",
  "manual",
  "portal",
]);

export const direction = pgEnum("direction", ["in", "out"]);

export const intentType = pgEnum("intent_type", [
  "buying",
  "selling",
  "renting",
  "investing",
  "browsing",
]);

export const sentiment = pgEnum("sentiment", ["hot", "warm", "neutral", "cooling"]);

export const consentChannel = pgEnum("consent_channel", ["email", "sms", "phone"]);
export const consentStatus = pgEnum("consent_status", [
  "granted",
  "revoked",
  "never_given",
]);

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),

    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),

    /**
     * Deduplication keys. Normalised at write time (lower-cased, plus-addressing
     * stripped for email; E.164 for phone) because identity resolution is only as
     * good as the normalisation behind it.
     */
    emailNormalised: text("email_normalised"),
    phoneE164: text("phone_e164"),
    emailRaw: text("email_raw"),
    phoneRaw: text("phone_raw"),

    secondaryEmail: text("secondary_email"),
    addressLine: text("address_line"),
    suburb: text("suburb"),

    sourceChannel: channel("source_channel").notNull().default("manual"),
    ownerUserId: uuid("owner_user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    lastFollowupAt: timestamp("last_followup_at", { withTimezone: true }),
    /**
     * A first-class column, not a note. It is what a day's work is sorted and
     * prioritised by, so it has to be queryable (§4).
     */
    lastFollowupOutcome: text("last_followup_outcome"),
    followupDueAt: timestamp("followup_due_at", { withTimezone: true }),

    /** Independent of channel consent. A hard stop checked on every send path. */
    doNotContact: boolean("do_not_contact").notNull().default(false),

    /**
     * Privacy deletion marks rather than erases, so the audit trail survives a
     * request that would otherwise destroy the evidence for past sends (§4, §10).
     */
    tombstonedAt: timestamp("tombstoned_at", { withTimezone: true }),

    /**
     * Set when a human resolves a merge review. The loser keeps its own rows -
     * interactions and consents are append-only and cannot be repointed without
     * destroying the provenance they exist to prove - so a merge supersedes rather
     * than rewrites, and reads of the survivor follow this pointer to pick up the
     * history. Depth is always one hop; a trigger refuses chains (migration 0006).
     */
    mergedIntoId: uuid("merged_into_id").references((): AnyPgColumn => contacts.id, {
      onDelete: "restrict",
    }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /**
     * Deliberately NOT unique.
     *
     * A hard unique constraint on the dedupe keys sounds right and is wrong: §4 says
     * ambiguous matches go to a merge review queue and are never auto-merged. A
     * duplicate therefore has to be able to EXIST while a human decides. Making the
     * column unique means the second record can never be written, so the merge queue
     * can never populate and the inbound message is simply lost.
     *
     * Uniqueness is a decision made by identity resolution (item 1.6), not a
     * constraint imposed by the table. These indexes exist to make that lookup fast.
     */
    index("contacts_tenant_email_idx").on(t.tenantId, t.emailNormalised),
    index("contacts_tenant_phone_idx").on(t.tenantId, t.phoneE164),
    index("contacts_tenant_idx").on(t.tenantId),
    index("contacts_followup_due_idx").on(t.tenantId, t.followupDueAt),
    index("contacts_owner_idx").on(t.ownerUserId),
  ],
);

export const contactRoles = pgTable(
  "contact_roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    role: contactRole("role").notNull(),
    /** Dated so a role can lapse without the history being lost. */
    activeFrom: date("active_from"),
    activeTo: date("active_to"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("contact_roles_uq").on(t.contactId, t.role),
    index("contact_roles_tenant_idx").on(t.tenantId),
  ],
);

export const contactPreferences = pgTable(
  "contact_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" })
      .unique(),

    /**
     * Suburbs live in their own join table (contactPreferenceSuburbs) so they carry a
     * real FK. §6's stage-1 filter is a suburb equality check, and a free-text
     * 'Nth Adelaide' would drop the contact from every match without erroring.
     */
    priceMin: integer("price_min"),
    priceMax: integer("price_max"),
    rentPwMin: integer("rent_pw_min"),
    rentPwMax: integer("rent_pw_max"),
    bedsMin: integer("beds_min"),
    bathsMin: integer("baths_min"),
    parkingMin: integer("parking_min"),
    landSizeMin: integer("land_size_min"),
    /** The SAME enum the stock side uses. Comparing text[] to an enum silently matched
     *  nothing: seeded properties held 'house' while preferences held 'House'. */
    propertyTypes: propertyTypeEnum("property_types").array(),
    timeline: text("timeline"),
    financeStatus: text("finance_status"),

    /**
     * The free text the similarity search actually reads - "quiet street, no main
     * road". This is what a filter cannot express, and the reason the matching engine
     * has a vector stage at all (§4, §6).
     */
    softRequirements: text("soft_requirements"),

    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("contact_preferences_tenant_idx").on(t.tenantId)],
);

/** A buyer's suburbs, as real references rather than strings. */
export const contactPreferenceSuburbs = pgTable(
  "contact_preference_suburbs",
  {
    preferenceId: uuid("preference_id")
      .notNull()
      .references(() => contactPreferences.id, { onDelete: "cascade" }),
    suburbId: uuid("suburb_id")
      .notNull()
      .references(() => suburbs.id, { onDelete: "restrict" }),
  },
  (t) => [uniqueIndex("contact_preference_suburbs_uq").on(t.preferenceId, t.suburbId)],
);

/**
 * Derived, never hand-edited. Rebuilt from the interaction log after every new touch,
 * so a wrong brief is fixed by correcting the interaction underneath it (§4).
 */
export const contactIntent = pgTable(
  "contact_intent",
  {
    contactId: uuid("contact_id")
      .primaryKey()
      .references(() => contacts.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),

    intentType: intentType("intent_type"),
    budgetBand: text("budget_band"),
    timeline: text("timeline"),
    blockers: text("blockers").array(),
    sentiment: sentiment("sentiment"),
    confidence: real("confidence"),
    rollingBrief: text("rolling_brief"),

    sourceInteractionCount: integer("source_interaction_count").notNull().default(0),
    rebuiltAt: timestamp("rebuilt_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("contact_intent_tenant_idx").on(t.tenantId)],
);

/**
 * Append-only. Corrections are new rows, never edits. A database-level guard against
 * UPDATE and DELETE is added in a follow-up migration - the constraint is the point,
 * not the convention (§4).
 */
export const interactions = pgTable(
  "interactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "restrict" }),

    channel: channel("channel").notNull(),
    direction: direction("direction").notNull(),
    /** When it actually happened, which is not when we recorded it. */
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),

    subject: text("subject"),
    body: text("body"),

    /** Where the original message lives. The record needs evidence, not just our summary. */
    rawS3Key: text("raw_s3_key"),
    threadRef: text("thread_ref"),
    messageId: text("message_id"),

    listingId: uuid("listing_id"),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    tombstonedAt: timestamp("tombstoned_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("interactions_contact_idx").on(t.contactId, t.occurredAt),
    index("interactions_tenant_idx").on(t.tenantId, t.occurredAt),
    index("interactions_thread_idx").on(t.threadRef),
  ],
);

/**
 * One row per contact per channel per grant. Provenance can only be captured at the
 * moment of submission and can never be reconstructed - without it a send cannot be
 * defended under the Spam Act (§4, §10).
 */
export const consents = pgTable(
  "consents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),

    channel: consentChannel("channel").notNull(),
    status: consentStatus("status").notNull(),

    sourceForm: text("source_form").notNull(),
    /** The exact text the person agreed to, frozen at the moment they agreed to it. */
    wordingShown: text("wording_shown").notNull(),
    ipAddress: text("ip_address"),
    evidenceS3Key: text("evidence_s3_key"),

    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("consents_contact_channel_idx").on(t.contactId, t.channel, t.occurredAt),
    index("consents_tenant_idx").on(t.tenantId),
  ],
);

export const mergeReviewStatus = pgEnum("merge_review_status", [
  "open",
  "merged",
  "kept_both",
]);

export const mergeReviews = pgTable(
  "merge_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    contactAId: uuid("contact_a_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    contactBId: uuid("contact_b_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    similarity: real("similarity").notNull(),
    matchedOn: text("matched_on").notNull(),
    status: mergeReviewStatus("status").notNull().default("open"),
    resolvedByUserId: uuid("resolved_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("merge_reviews_tenant_status_idx").on(t.tenantId, t.status)],
);

export const confirmKind = pgEnum("confirm_kind", [
  "task",
  "preference_change",
  "intent_correction",
]);
export const confirmStatus = pgEnum("confirm_status", [
  "pending",
  "committed",
  "discarded",
]);

/**
 * Everything the AI thinks it found, waiting for a human to commit it. Rule 5: the AI
 * never writes to a contact record on its own.
 */
export const confirmItems = pgTable(
  "confirm_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    sourceInteractionId: uuid("source_interaction_id").references(
      () => interactions.id,
      { onDelete: "set null" },
    ),
    /** Extraction can come from a voice note rather than an interaction. */
    sourceVoiceNoteId: uuid("source_voice_note_id"),

    kind: confirmKind("kind").notNull(),
    summary: text("summary").notNull(),
    beforeText: text("before_text"),
    afterText: text("after_text").notNull(),
    /** The structured change, so committing is applying data rather than parsing prose. */
    proposed: jsonb("proposed"),
    confidence: real("confidence"),

    status: confirmStatus("status").notNull().default("pending"),
    committedByUserId: uuid("committed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    committedAt: timestamp("committed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("confirm_items_tenant_status_idx").on(t.tenantId, t.status),
    index("confirm_items_contact_idx").on(t.contactId),
  ],
);

CREATE TYPE "public"."auth_provider" AS ENUM('google', 'entra', 'local');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('principal', 'agent', 'admin');--> statement-breakpoint
CREATE TYPE "public"."channel" AS ENUM('web_form', 'email', 'sms', 'social', 'phone', 'voice_note', 'manual', 'portal');--> statement-breakpoint
CREATE TYPE "public"."confirm_kind" AS ENUM('task', 'preference_change', 'intent_correction');--> statement-breakpoint
CREATE TYPE "public"."confirm_status" AS ENUM('pending', 'committed', 'discarded');--> statement-breakpoint
CREATE TYPE "public"."consent_channel" AS ENUM('email', 'sms', 'phone');--> statement-breakpoint
CREATE TYPE "public"."consent_status" AS ENUM('granted', 'revoked', 'never_given');--> statement-breakpoint
CREATE TYPE "public"."contact_role" AS ENUM('buyer', 'vendor', 'landlord', 'tenant', 'referrer', 'investor', 'business_vendor');--> statement-breakpoint
CREATE TYPE "public"."direction" AS ENUM('in', 'out');--> statement-breakpoint
CREATE TYPE "public"."intent_type" AS ENUM('buying', 'selling', 'renting', 'investing', 'browsing');--> statement-breakpoint
CREATE TYPE "public"."merge_review_status" AS ENUM('open', 'merged', 'kept_both');--> statement-breakpoint
CREATE TYPE "public"."sentiment" AS ENUM('hot', 'warm', 'neutral', 'cooling');--> statement-breakpoint
CREATE TYPE "public"."inspection_kind" AS ENUM('open', 'private');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('draft', 'live', 'under_offer', 'sold', 'leased', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."listing_type" AS ENUM('sale', 'rent');--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('photo', 'floorplan', 'video');--> statement-breakpoint
CREATE TYPE "public"."property_type" AS ENUM('house', 'unit', 'townhouse', 'land', 'acreage', 'commercial');--> statement-breakpoint
CREATE TYPE "public"."approval_kind" AS ENUM('email', 'sms', 'social', 'article', 'proposal', 'digest');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'sent', 'blocked', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."campaign_channel" AS ENUM('email', 'sms');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'in_approval', 'sending', 'sent', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."match_stage" AS ENUM('filter', 'vector', 'ranked');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('draft', 'in_approval', 'sent', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."adapter_status" AS ENUM('ok', 'degraded', 'down');--> statement-breakpoint
CREATE TYPE "public"."audit_kind" AS ENUM('approve', 'reject', 'edit', 'merge', 'publish', 'commit', 'login', 'block');--> statement-breakpoint
CREATE TYPE "public"."calendar_kind" AS ENUM('inspection', 'appraisal', 'meeting', 'settlement', 'personal');--> statement-breakpoint
CREATE TYPE "public"."calendar_provider" AS ENUM('google', 'outlook', 'ozirealty');--> statement-breakpoint
CREATE TYPE "public"."publish_status" AS ENUM('draft', 'in_approval', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."redirect_status" AS ENUM('mapped', 'undecided', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."seo_issue_status" AS ENUM('open', 'accepted', 'dismissed', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."seo_severity" AS ENUM('critical', 'warning', 'info');--> statement-breakpoint
CREATE TYPE "public"."social_network" AS ENUM('instagram', 'facebook', 'linkedin');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('open', 'done', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."voice_status" AS ENUM('uploaded', 'processing', 'transcribed', 'confirmed', 'failed');--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"trading_name" text,
	"abn" text,
	"licence_number" text,
	"jurisdiction" text DEFAULT 'SA' NOT NULL,
	"timezone" text DEFAULT 'Australia/Adelaide' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" "user_role" DEFAULT 'agent' NOT NULL,
	"provider" "auth_provider" DEFAULT 'google' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "confirm_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"source_interaction_id" uuid,
	"kind" "confirm_kind" NOT NULL,
	"summary" text NOT NULL,
	"before_text" text,
	"after_text" text NOT NULL,
	"proposed" jsonb,
	"confidence" real,
	"status" "confirm_status" DEFAULT 'pending' NOT NULL,
	"committed_by_user_id" uuid,
	"committed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"channel" "consent_channel" NOT NULL,
	"status" "consent_status" NOT NULL,
	"source_form" text NOT NULL,
	"wording_shown" text NOT NULL,
	"ip_address" text,
	"evidence_s3_key" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_intent" (
	"contact_id" uuid PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"intent_type" "intent_type",
	"budget_band" text,
	"timeline" text,
	"blockers" text[],
	"sentiment" "sentiment",
	"confidence" real,
	"rolling_brief" text,
	"source_interaction_count" integer DEFAULT 0 NOT NULL,
	"rebuilt_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"suburbs" text[],
	"price_min" integer,
	"price_max" integer,
	"rent_pw_min" integer,
	"rent_pw_max" integer,
	"beds_min" integer,
	"baths_min" integer,
	"parking_min" integer,
	"land_size_min" integer,
	"property_types" text[],
	"timeline" text,
	"finance_status" text,
	"soft_requirements" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contact_preferences_contact_id_unique" UNIQUE("contact_id")
);
--> statement-breakpoint
CREATE TABLE "contact_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"role" "contact_role" NOT NULL,
	"active_from" date,
	"active_to" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email_normalised" text,
	"phone_e164" text,
	"email_raw" text,
	"phone_raw" text,
	"secondary_email" text,
	"address_line" text,
	"suburb" text,
	"source_channel" "channel" DEFAULT 'manual' NOT NULL,
	"owner_user_id" uuid,
	"last_followup_at" timestamp with time zone,
	"last_followup_outcome" text,
	"followup_due_at" timestamp with time zone,
	"do_not_contact" boolean DEFAULT false NOT NULL,
	"tombstoned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"channel" "channel" NOT NULL,
	"direction" "direction" NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"subject" text,
	"body" text,
	"raw_s3_key" text,
	"thread_ref" text,
	"message_id" text,
	"listing_id" uuid,
	"created_by_user_id" uuid,
	"tombstoned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merge_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"contact_a_id" uuid NOT NULL,
	"contact_b_id" uuid NOT NULL,
	"similarity" real NOT NULL,
	"matched_on" text NOT NULL,
	"status" "merge_review_status" DEFAULT 'open' NOT NULL,
	"resolved_by_user_id" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inspection_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"inspection_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attended" boolean
);
--> statement-breakpoint
CREATE TABLE "inspections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"minutes" integer DEFAULT 30 NOT NULL,
	"kind" "inspection_kind" DEFAULT 'open' NOT NULL,
	"capacity" integer,
	"cancelled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_agents" (
	"listing_id" uuid NOT NULL,
	"user_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listing_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"s3_key" text NOT NULL,
	"kind" "media_kind" DEFAULT 'photo' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"alt_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"listing_type" "listing_type" NOT NULL,
	"method" text,
	"status" "listing_status" DEFAULT 'draft' NOT NULL,
	"price_display" text,
	"search_price_min" integer,
	"search_price_max" integer,
	"rent_pw" integer,
	"available_from" timestamp with time zone,
	"public_headline" text,
	"public_copy" text,
	"slug" text NOT NULL,
	"listed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	"sold_at" timestamp with time zone,
	"result_display" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"unit" text,
	"street_number" text,
	"street" text,
	"suburb_id" uuid,
	"state" text DEFAULT 'SA' NOT NULL,
	"postcode" text,
	"gnaf_pid" text,
	"gnaf_matched_at" timestamp with time zone,
	"latitude" double precision,
	"longitude" double precision,
	"geocoded_at" timestamp with time zone,
	"geocode_source" text,
	"property_type" "property_type" NOT NULL,
	"beds" integer,
	"baths" integer,
	"parking" integer,
	"land_area_sqm" integer,
	"floor_area_sqm" integer,
	"year_built" integer,
	"condition" text,
	"features" text[],
	"owner_contact_id" uuid,
	"internal_notes" text,
	"internal_price_expectation" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suburbs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"state" text DEFAULT 'SA' NOT NULL,
	"postcode" text NOT NULL,
	"latitude" double precision,
	"longitude" double precision
);
--> statement-breakpoint
CREATE TABLE "approval_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kind" "approval_kind" NOT NULL,
	"status" "approval_status" DEFAULT 'pending' NOT NULL,
	"contact_id" uuid,
	"listing_id" uuid,
	"campaign_id" uuid,
	"draft_subject" text,
	"draft_body" text NOT NULL,
	"original_body" text,
	"consent_at_draft" "consent_status",
	"consent_checked_at" timestamp with time zone,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"reject_reason" text,
	"sent_at" timestamp with time zone,
	"block_reason" text,
	"provider_message_id" text,
	"model" text,
	"cost_aud" numeric(10, 4),
	"ai_generation_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"listing_id" uuid,
	"name" text NOT NULL,
	"channel" "campaign_channel" NOT NULL,
	"status" "campaign_status" DEFAULT 'draft' NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"score" real NOT NULL,
	"reason" text NOT NULL,
	"stage" "match_stage" NOT NULL,
	"ai_generation_id" uuid,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"property_id" uuid,
	"contact_id" uuid NOT NULL,
	"status" "proposal_status" DEFAULT 'draft' NOT NULL,
	"estimate_low" integer,
	"estimate_high" integer,
	"comparables" integer,
	"pages" integer,
	"pdf_s3_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"filter" jsonb NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"task" text NOT NULL,
	"model" text NOT NULL,
	"prompt_hash" text,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cached_input_tokens" integer DEFAULT 0 NOT NULL,
	"cost_aud" numeric(10, 6) DEFAULT '0' NOT NULL,
	"latency_ms" integer,
	"entity_type" text,
	"entity_id" uuid,
	"succeeded" boolean DEFAULT true NOT NULL,
	"raw_response" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"actor_label" text NOT NULL,
	"kind" "audit_kind" NOT NULL,
	"action" text NOT NULL,
	"target" text NOT NULL,
	"entity_type" text,
	"entity_id" uuid,
	"metadata" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"status" "publish_status" DEFAULT 'draft' NOT NULL,
	"word_count" integer,
	"published_at" timestamp with time zone,
	"legacy_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid,
	"provider" "calendar_provider" NOT NULL,
	"external_id" text,
	"our_write" boolean DEFAULT false NOT NULL,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"kind" "calendar_kind",
	"contact_id" uuid,
	"listing_id" uuid,
	"sync_token" text,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_adapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"status" "adapter_status" DEFAULT 'ok' NOT NULL,
	"last_received_at" timestamp with time zone,
	"received_today" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consent_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"form_name" text NOT NULL,
	"wording" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disclosure_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"jurisdiction" text NOT NULL,
	"name" text NOT NULL,
	"detail" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "redirects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"from_path" text NOT NULL,
	"to_path" text,
	"status" "redirect_status" DEFAULT 'undecided' NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "seo_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"severity" "seo_severity" NOT NULL,
	"title" text NOT NULL,
	"detail" text NOT NULL,
	"proposal" text NOT NULL,
	"affected_count" integer DEFAULT 0 NOT NULL,
	"status" "seo_issue_status" DEFAULT 'open' NOT NULL,
	"crawled_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"network" "social_network" NOT NULL,
	"status" "publish_status" DEFAULT 'draft' NOT NULL,
	"body" text NOT NULL,
	"listing_id" uuid,
	"engagement" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suburb_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"suburb_name" text NOT NULL,
	"market_copy" text,
	"status" "publish_status" DEFAULT 'draft' NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"contact_id" uuid,
	"listing_id" uuid,
	"title" text NOT NULL,
	"due_at" timestamp with time zone,
	"status" "task_status" DEFAULT 'open' NOT NULL,
	"source_interaction_id" uuid,
	"source_label" text,
	"assigned_to_user_id" uuid,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voice_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid,
	"contact_id" uuid,
	"s3_key" text NOT NULL,
	"duration_seconds" integer,
	"transcript" text,
	"transcribed_at" timestamp with time zone,
	"status" "voice_status" DEFAULT 'uploaded' NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "confirm_items" ADD CONSTRAINT "confirm_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "confirm_items" ADD CONSTRAINT "confirm_items_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "confirm_items" ADD CONSTRAINT "confirm_items_source_interaction_id_interactions_id_fk" FOREIGN KEY ("source_interaction_id") REFERENCES "public"."interactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "confirm_items" ADD CONSTRAINT "confirm_items_committed_by_user_id_users_id_fk" FOREIGN KEY ("committed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_intent" ADD CONSTRAINT "contact_intent_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_intent" ADD CONSTRAINT "contact_intent_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_preferences" ADD CONSTRAINT "contact_preferences_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_preferences" ADD CONSTRAINT "contact_preferences_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_roles" ADD CONSTRAINT "contact_roles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_roles" ADD CONSTRAINT "contact_roles_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merge_reviews" ADD CONSTRAINT "merge_reviews_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merge_reviews" ADD CONSTRAINT "merge_reviews_contact_a_id_contacts_id_fk" FOREIGN KEY ("contact_a_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merge_reviews" ADD CONSTRAINT "merge_reviews_contact_b_id_contacts_id_fk" FOREIGN KEY ("contact_b_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merge_reviews" ADD CONSTRAINT "merge_reviews_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_registrations" ADD CONSTRAINT "inspection_registrations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_registrations" ADD CONSTRAINT "inspection_registrations_inspection_id_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."inspections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_registrations" ADD CONSTRAINT "inspection_registrations_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_agents" ADD CONSTRAINT "listing_agents_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_agents" ADD CONSTRAINT "listing_agents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_media" ADD CONSTRAINT "listing_media_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_media" ADD CONSTRAINT "listing_media_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_suburb_id_suburbs_id_fk" FOREIGN KEY ("suburb_id") REFERENCES "public"."suburbs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_owner_contact_id_contacts_id_fk" FOREIGN KEY ("owner_contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_items" ADD CONSTRAINT "approval_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_items" ADD CONSTRAINT "approval_items_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_items" ADD CONSTRAINT "approval_items_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_items" ADD CONSTRAINT "approval_items_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_items" ADD CONSTRAINT "approval_items_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_adapters" ADD CONSTRAINT "channel_adapters_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent_templates" ADD CONSTRAINT "consent_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disclosure_rules" ADD CONSTRAINT "disclosure_rules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redirects" ADD CONSTRAINT "redirects_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seo_issues" ADD CONSTRAINT "seo_issues_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suburb_pages" ADD CONSTRAINT "suburb_pages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_source_interaction_id_interactions_id_fk" FOREIGN KEY ("source_interaction_id") REFERENCES "public"."interactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_notes" ADD CONSTRAINT "voice_notes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_notes" ADD CONSTRAINT "voice_notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voice_notes" ADD CONSTRAINT "voice_notes_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_tenant_idx" ON "users" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "confirm_items_tenant_status_idx" ON "confirm_items" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "confirm_items_contact_idx" ON "confirm_items" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "consents_contact_channel_idx" ON "consents" USING btree ("contact_id","channel","occurred_at");--> statement-breakpoint
CREATE INDEX "consents_tenant_idx" ON "consents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "contact_intent_tenant_idx" ON "contact_intent" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "contact_preferences_tenant_idx" ON "contact_preferences" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contact_roles_uq" ON "contact_roles" USING btree ("contact_id","role");--> statement-breakpoint
CREATE INDEX "contact_roles_tenant_idx" ON "contact_roles" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_tenant_email_uq" ON "contacts" USING btree ("tenant_id","email_normalised") WHERE "contacts"."email_normalised" is not null and "contacts"."tombstoned_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_tenant_phone_uq" ON "contacts" USING btree ("tenant_id","phone_e164") WHERE "contacts"."phone_e164" is not null and "contacts"."tombstoned_at" is null;--> statement-breakpoint
CREATE INDEX "contacts_tenant_idx" ON "contacts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "contacts_followup_due_idx" ON "contacts" USING btree ("tenant_id","followup_due_at");--> statement-breakpoint
CREATE INDEX "contacts_owner_idx" ON "contacts" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "interactions_contact_idx" ON "interactions" USING btree ("contact_id","occurred_at");--> statement-breakpoint
CREATE INDEX "interactions_tenant_idx" ON "interactions" USING btree ("tenant_id","occurred_at");--> statement-breakpoint
CREATE INDEX "interactions_thread_idx" ON "interactions" USING btree ("thread_ref");--> statement-breakpoint
CREATE INDEX "merge_reviews_tenant_status_idx" ON "merge_reviews" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "inspection_registrations_uq" ON "inspection_registrations" USING btree ("inspection_id","contact_id");--> statement-breakpoint
CREATE INDEX "inspection_registrations_tenant_idx" ON "inspection_registrations" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "inspections_listing_idx" ON "inspections" USING btree ("listing_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "listing_agents_uq" ON "listing_agents" USING btree ("listing_id","user_id");--> statement-breakpoint
CREATE INDEX "listing_media_listing_idx" ON "listing_media" USING btree ("listing_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "listings_slug_uq" ON "listings" USING btree ("tenant_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "listings_one_live_per_property_uq" ON "listings" USING btree ("property_id") WHERE "listings"."status" in ('live','under_offer');--> statement-breakpoint
CREATE INDEX "listings_tenant_status_idx" ON "listings" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "listings_property_idx" ON "listings" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "listings_search_idx" ON "listings" USING btree ("tenant_id","listing_type","search_price_min");--> statement-breakpoint
CREATE INDEX "properties_tenant_idx" ON "properties" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "properties_suburb_idx" ON "properties" USING btree ("suburb_id");--> statement-breakpoint
CREATE INDEX "properties_owner_idx" ON "properties" USING btree ("owner_contact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "suburbs_uq" ON "suburbs" USING btree ("name","state","postcode");--> statement-breakpoint
CREATE INDEX "approval_items_tenant_status_idx" ON "approval_items" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "approval_items_contact_idx" ON "approval_items" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "approval_items_campaign_idx" ON "approval_items" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "campaigns_tenant_status_idx" ON "campaigns" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "matches_uq" ON "matches" USING btree ("listing_id","contact_id");--> statement-breakpoint
CREATE INDEX "matches_listing_score_idx" ON "matches" USING btree ("listing_id","score");--> statement-breakpoint
CREATE INDEX "matches_contact_score_idx" ON "matches" USING btree ("contact_id","score");--> statement-breakpoint
CREATE INDEX "proposals_tenant_status_idx" ON "proposals" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_views_uq" ON "saved_views" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE INDEX "ai_generations_tenant_created_idx" ON "ai_generations" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_generations_task_idx" ON "ai_generations" USING btree ("tenant_id","task");--> statement-breakpoint
CREATE INDEX "ai_generations_entity_idx" ON "ai_generations" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_tenant_time_idx" ON "audit_log" USING btree ("tenant_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "blog_posts_slug_uq" ON "blog_posts" USING btree ("tenant_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_events_external_uq" ON "calendar_events" USING btree ("provider","external_id");--> statement-breakpoint
CREATE INDEX "calendar_events_tenant_start_idx" ON "calendar_events" USING btree ("tenant_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_adapters_uq" ON "channel_adapters" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "consent_templates_uq" ON "consent_templates" USING btree ("tenant_id","form_name");--> statement-breakpoint
CREATE UNIQUE INDEX "disclosure_rules_uq" ON "disclosure_rules" USING btree ("tenant_id","jurisdiction","name");--> statement-breakpoint
CREATE UNIQUE INDEX "redirects_from_uq" ON "redirects" USING btree ("tenant_id","from_path");--> statement-breakpoint
CREATE INDEX "seo_issues_tenant_status_idx" ON "seo_issues" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "social_posts_tenant_status_idx" ON "social_posts" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "suburb_pages_uq" ON "suburb_pages" USING btree ("tenant_id","suburb_name");--> statement-breakpoint
CREATE INDEX "tasks_tenant_status_due_idx" ON "tasks" USING btree ("tenant_id","status","due_at");--> statement-breakpoint
CREATE INDEX "tasks_contact_idx" ON "tasks" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "voice_notes_tenant_idx" ON "voice_notes" USING btree ("tenant_id","recorded_at");
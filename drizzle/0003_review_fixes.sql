CREATE TYPE "public"."property_status" AS ENUM('prospect', 'appraised', 'off_market', 'listed', 'sold', 'archived');--> statement-breakpoint
CREATE TABLE "contact_preference_suburbs" (
	"preference_id" uuid NOT NULL,
	"suburb_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"approval_item_id" uuid,
	"sent_at" timestamp with time zone,
	"opened_at" timestamp with time zone,
	"replied_at" timestamp with time zone,
	"blocked_reason" text
);
--> statement-breakpoint
ALTER TABLE "approval_items" DROP CONSTRAINT "approval_items_contact_id_contacts_id_fk";
--> statement-breakpoint
ALTER TABLE "approval_items" DROP CONSTRAINT "approval_items_campaign_id_campaigns_id_fk";
--> statement-breakpoint
ALTER TABLE "proposals" DROP CONSTRAINT "proposals_contact_id_contacts_id_fk";
--> statement-breakpoint
-- Existing rows hold Title Case ('House'); the enum is lower case ('house'). A bare
-- cast fails on any populated database, so normalise inside the USING clause. This is
-- exactly the mismatch that made the stage-1 filter return zero matches.
-- USING takes an expression, not a subquery. Casting the whole array to text lets one
-- lower() handle every element: '{House,Townhouse}' -> '{house,townhouse}'.
ALTER TABLE "contact_preferences" ALTER COLUMN "property_types" SET DATA TYPE "public"."property_type"[]
  USING lower("property_types"::text)::"public"."property_type"[];--> statement-breakpoint
ALTER TABLE "confirm_items" ADD COLUMN "source_voice_note_id" uuid;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "views_7d" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "enquiries_7d" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "traffic_refreshed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "properties" ADD COLUMN "status" "property_status" DEFAULT 'prospect' NOT NULL;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "views_30d" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "contact_preference_suburbs" ADD CONSTRAINT "contact_preference_suburbs_preference_id_contact_preferences_id_fk" FOREIGN KEY ("preference_id") REFERENCES "public"."contact_preferences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_preference_suburbs" ADD CONSTRAINT "contact_preference_suburbs_suburb_id_suburbs_id_fk" FOREIGN KEY ("suburb_id") REFERENCES "public"."suburbs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_recipients" ADD CONSTRAINT "campaign_recipients_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contact_preference_suburbs_uq" ON "contact_preference_suburbs" USING btree ("preference_id","suburb_id");--> statement-breakpoint
CREATE UNIQUE INDEX "campaign_recipients_uq" ON "campaign_recipients" USING btree ("campaign_id","contact_id");--> statement-breakpoint
CREATE INDEX "campaign_recipients_tenant_idx" ON "campaign_recipients" USING btree ("tenant_id");--> statement-breakpoint
ALTER TABLE "approval_items" ADD CONSTRAINT "approval_items_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approval_items" ADD CONSTRAINT "approval_items_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
-- Carry the free-text suburbs into the join table before dropping the column, matching
-- on name. Anything that does not match a seeded suburb is reported rather than lost.
DO $$
DECLARE unmatched text;
BEGIN
  INSERT INTO "contact_preference_suburbs" (preference_id, suburb_id)
  SELECT cp.id, s.id
  FROM "contact_preferences" cp
  CROSS JOIN LATERAL unnest(COALESCE(cp."suburbs", '{}')) AS want(name)
  JOIN "suburbs" s ON s.name = want.name
  ON CONFLICT DO NOTHING;

  SELECT string_agg(DISTINCT want.name, ', ') INTO unmatched
  FROM "contact_preferences" cp
  CROSS JOIN LATERAL unnest(COALESCE(cp."suburbs", '{}')) AS want(name)
  LEFT JOIN "suburbs" s ON s.name = want.name
  WHERE s.id IS NULL;

  IF unmatched IS NOT NULL THEN
    RAISE WARNING 'contact_preferences.suburbs values with no matching suburb row: %', unmatched;
  END IF;
END $$;

ALTER TABLE "contact_preferences" DROP COLUMN "suburbs";
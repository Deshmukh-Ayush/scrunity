CREATE TABLE "gtm_vendor_usage" (
	"id" text PRIMARY KEY NOT NULL,
	"vendor" text NOT NULL,
	"endpoint" text NOT NULL,
	"credits_used" integer NOT NULL,
	"organization_id" text,
	"research_run_id" text,
	"campaign_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gtm_icp_segment" ADD COLUMN "target_keywords" jsonb;--> statement-breakpoint
ALTER TABLE "gtm_icp_segment" ADD COLUMN "headcount_min" integer;--> statement-breakpoint
ALTER TABLE "gtm_icp_segment" ADD COLUMN "headcount_max" integer;--> statement-breakpoint
ALTER TABLE "gtm_outreach_campaign" ADD COLUMN "target_country_code" text;--> statement-breakpoint
ALTER TABLE "gtm_outreach_campaign" ADD COLUMN "target_region" text;--> statement-breakpoint
ALTER TABLE "gtm_outreach_campaign" ADD COLUMN "discovery_note" text;--> statement-breakpoint
ALTER TABLE "gtm_prospect_company" ADD COLUMN "source" text DEFAULT 'web_search' NOT NULL;--> statement-breakpoint
ALTER TABLE "gtm_prospect_company" ADD COLUMN "provider_id" text;--> statement-breakpoint
ALTER TABLE "gtm_prospect_company" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "gtm_prospect_company" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "gtm_prospect_company" ADD COLUMN "state" text;--> statement-breakpoint
ALTER TABLE "gtm_prospect_company" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "gtm_prospect_company" ADD COLUMN "industry" text;--> statement-breakpoint
ALTER TABLE "gtm_prospect_company" ADD COLUMN "headcount" integer;--> statement-breakpoint
ALTER TABLE "gtm_prospect_company" ADD COLUMN "revenue_range" text;--> statement-breakpoint
ALTER TABLE "gtm_research_run" ADD COLUMN "target_country_code" text;--> statement-breakpoint
ALTER TABLE "gtm_research_run" ADD COLUMN "target_region" text;--> statement-breakpoint
ALTER TABLE "gtm_research_run" ADD COLUMN "own_arr_amount" bigint;--> statement-breakpoint
ALTER TABLE "gtm_research_run" ADD COLUMN "own_arr_currency" text;--> statement-breakpoint
ALTER TABLE "gtm_research_run" ADD COLUMN "own_tam_amount" bigint;--> statement-breakpoint
ALTER TABLE "gtm_research_run" ADD COLUMN "own_tam_currency" text;--> statement-breakpoint
ALTER TABLE "gtm_vendor_usage" ADD CONSTRAINT "gtm_vendor_usage_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gtm_vendor_usage_vendor_created_idx" ON "gtm_vendor_usage" USING btree ("vendor","created_at");
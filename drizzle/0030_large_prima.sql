ALTER TABLE "gtm_outreach_campaign" ADD COLUMN "search_filters" jsonb;--> statement-breakpoint
ALTER TABLE "gtm_outreach_campaign" ADD COLUMN "stage_attempt_id" text;--> statement-breakpoint
ALTER TABLE "gtm_outreach_campaign" ADD COLUMN "stage_attempt_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "gtm_outreach_campaign" ADD COLUMN "lead_search_state" jsonb;--> statement-breakpoint
ALTER TABLE "gtm_prospect_company" ADD COLUMN "fit_score" integer;--> statement-breakpoint
ALTER TABLE "gtm_prospect_company" ADD COLUMN "lead_search_state" jsonb;
ALTER TABLE "gtm_contact" ADD COLUMN "email_lookup_ref" text;--> statement-breakpoint
ALTER TABLE "gtm_contact" ADD COLUMN "email_looked_up_at" timestamp;--> statement-breakpoint
ALTER TABLE "gtm_contact" ADD COLUMN "skip_reason" text;--> statement-breakpoint
ALTER TABLE "gtm_outreach_campaign" ADD COLUMN "target_verified_leads" integer;--> statement-breakpoint
ALTER TABLE "gtm_outreach_campaign" ADD COLUMN "lead_search_outcome" jsonb;--> statement-breakpoint
ALTER TABLE "gtm_outreach_campaign" ADD COLUMN "stage_timings" jsonb;--> statement-breakpoint
ALTER TABLE "gtm_research_run" ADD COLUMN "stage_timings" jsonb;
ALTER TABLE "gtm_outreach_campaign" ADD COLUMN "stage_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "gtm_outreach_campaign" ADD COLUMN "last_progress_at" timestamp;--> statement-breakpoint
ALTER TABLE "gtm_research_run" ADD COLUMN "stage_started_at" timestamp;--> statement-breakpoint
ALTER TABLE "gtm_research_run" ADD COLUMN "last_progress_at" timestamp;
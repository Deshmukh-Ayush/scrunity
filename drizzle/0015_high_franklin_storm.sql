ALTER TABLE "gtm_outreach_campaign" ADD COLUMN "failure_reason" text;--> statement-breakpoint
ALTER TABLE "gtm_outreach_campaign" ADD COLUMN "firecrawl_call_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "gtm_research_run" ADD COLUMN "failure_reason" text;--> statement-breakpoint
ALTER TABLE "gtm_research_run" ADD COLUMN "firecrawl_call_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_credit_period" ADD COLUMN "firecrawl_credits_used" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_credit_period" ADD COLUMN "firecrawl_alerts_sent" jsonb DEFAULT '[]'::jsonb;
CREATE TABLE "billing_webhook_event" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"organization_id" text,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "gtm_outreach_campaign" ADD COLUMN "firecrawl_attempt_call_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "gtm_research_run" ADD COLUMN "firecrawl_attempt_call_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "member_org_user_unique" ON "member" USING btree ("organization_id","user_id");
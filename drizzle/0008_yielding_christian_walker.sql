CREATE TABLE "gtm_company_metric_snapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"prospect_company_id" text NOT NULL,
	"scraped_at" timestamp DEFAULT now() NOT NULL,
	"employee_count_label" text,
	"linkedin_follower_count" integer
);
--> statement-breakpoint
CREATE TABLE "gtm_competitor" (
	"id" text PRIMARY KEY NOT NULL,
	"research_run_id" text NOT NULL,
	"name" text NOT NULL,
	"domain" text NOT NULL,
	"description" text NOT NULL,
	"keywords" jsonb,
	"logo_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gtm_contact" (
	"id" text PRIMARY KEY NOT NULL,
	"prospect_company_id" text NOT NULL,
	"name" text NOT NULL,
	"title" text NOT NULL,
	"linkedin_url" text,
	"email" text,
	"email_source" text DEFAULT 'none' NOT NULL,
	"geo" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gtm_email_draft" (
	"id" text PRIMARY KEY NOT NULL,
	"contact_id" text NOT NULL,
	"outreach_campaign_id" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "gtm_icp_segment" (
	"id" text PRIMARY KEY NOT NULL,
	"research_run_id" text NOT NULL,
	"name" text NOT NULL,
	"pain_point" text NOT NULL,
	"criteria" jsonb NOT NULL,
	"example_companies" jsonb NOT NULL,
	"estimated_size_label" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gtm_outreach_campaign" (
	"id" text PRIMARY KEY NOT NULL,
	"icp_segment_id" text NOT NULL,
	"research_run_id" text NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"current_stage" text DEFAULT 'find_companies' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gtm_prospect_company" (
	"id" text PRIMARY KEY NOT NULL,
	"outreach_campaign_id" text NOT NULL,
	"name" text NOT NULL,
	"domain" text NOT NULL,
	"description" text NOT NULL,
	"location" text NOT NULL,
	"linkedin_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gtm_research_run" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"website_url" text NOT NULL,
	"company_name" text NOT NULL,
	"company_description" text NOT NULL,
	"logo_url" text,
	"company_size" text NOT NULL,
	"context_doc" text,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"current_stage" text DEFAULT 'research_company' NOT NULL,
	"linkedin_url" text,
	"twitter_url" text,
	"instagram_url" text,
	"seo_keywords" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gtm_company_metric_snapshot" ADD CONSTRAINT "gtm_company_metric_snapshot_prospect_company_id_gtm_prospect_company_id_fk" FOREIGN KEY ("prospect_company_id") REFERENCES "public"."gtm_prospect_company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gtm_competitor" ADD CONSTRAINT "gtm_competitor_research_run_id_gtm_research_run_id_fk" FOREIGN KEY ("research_run_id") REFERENCES "public"."gtm_research_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gtm_contact" ADD CONSTRAINT "gtm_contact_prospect_company_id_gtm_prospect_company_id_fk" FOREIGN KEY ("prospect_company_id") REFERENCES "public"."gtm_prospect_company"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gtm_email_draft" ADD CONSTRAINT "gtm_email_draft_contact_id_gtm_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."gtm_contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gtm_email_draft" ADD CONSTRAINT "gtm_email_draft_outreach_campaign_id_gtm_outreach_campaign_id_fk" FOREIGN KEY ("outreach_campaign_id") REFERENCES "public"."gtm_outreach_campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gtm_email_draft" ADD CONSTRAINT "gtm_email_draft_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gtm_icp_segment" ADD CONSTRAINT "gtm_icp_segment_research_run_id_gtm_research_run_id_fk" FOREIGN KEY ("research_run_id") REFERENCES "public"."gtm_research_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gtm_outreach_campaign" ADD CONSTRAINT "gtm_outreach_campaign_icp_segment_id_gtm_icp_segment_id_fk" FOREIGN KEY ("icp_segment_id") REFERENCES "public"."gtm_icp_segment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gtm_outreach_campaign" ADD CONSTRAINT "gtm_outreach_campaign_research_run_id_gtm_research_run_id_fk" FOREIGN KEY ("research_run_id") REFERENCES "public"."gtm_research_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gtm_prospect_company" ADD CONSTRAINT "gtm_prospect_company_outreach_campaign_id_gtm_outreach_campaign_id_fk" FOREIGN KEY ("outreach_campaign_id") REFERENCES "public"."gtm_outreach_campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gtm_research_run" ADD CONSTRAINT "gtm_research_run_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gtm_research_run" ADD CONSTRAINT "gtm_research_run_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gtm_metric_snapshot_company_idx" ON "gtm_company_metric_snapshot" USING btree ("prospect_company_id");--> statement-breakpoint
CREATE INDEX "gtm_competitor_run_idx" ON "gtm_competitor" USING btree ("research_run_id");--> statement-breakpoint
CREATE INDEX "gtm_contact_company_idx" ON "gtm_contact" USING btree ("prospect_company_id");--> statement-breakpoint
CREATE INDEX "gtm_email_draft_contact_idx" ON "gtm_email_draft" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "gtm_email_draft_campaign_idx" ON "gtm_email_draft" USING btree ("outreach_campaign_id");--> statement-breakpoint
CREATE INDEX "gtm_icp_segment_run_idx" ON "gtm_icp_segment" USING btree ("research_run_id");--> statement-breakpoint
CREATE INDEX "gtm_campaign_segment_idx" ON "gtm_outreach_campaign" USING btree ("icp_segment_id");--> statement-breakpoint
CREATE INDEX "gtm_campaign_run_idx" ON "gtm_outreach_campaign" USING btree ("research_run_id");--> statement-breakpoint
CREATE INDEX "gtm_prospect_company_campaign_idx" ON "gtm_prospect_company" USING btree ("outreach_campaign_id");--> statement-breakpoint
CREATE INDEX "gtm_research_run_org_idx" ON "gtm_research_run" USING btree ("organization_id");
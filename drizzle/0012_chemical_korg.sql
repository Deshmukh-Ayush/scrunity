CREATE TABLE "organization_credit_period" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"ai_credits_allotted" integer DEFAULT 0 NOT NULL,
	"ai_credits_used" integer DEFAULT 0 NOT NULL,
	"search_credits_allotted" integer DEFAULT 0 NOT NULL,
	"search_credits_used" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_event" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text,
	"type" text NOT NULL,
	"tool_name" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gtm_contact" ADD COLUMN "enrich_metadata" jsonb;--> statement-breakpoint
ALTER TABLE "organization_credit_period" ADD CONSTRAINT "organization_credit_period_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_event" ADD CONSTRAINT "usage_event_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_event" ADD CONSTRAINT "usage_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "org_credit_period_org_idx" ON "organization_credit_period" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "org_credit_period_dates_idx" ON "organization_credit_period" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "usage_event_org_idx" ON "usage_event" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "usage_event_created_idx" ON "usage_event" USING btree ("created_at");
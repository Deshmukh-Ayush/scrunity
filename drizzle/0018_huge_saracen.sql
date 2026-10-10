CREATE TABLE "gtm_ai_credit_period" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"plan" text NOT NULL,
	"plan_allotment" integer DEFAULT 0 NOT NULL,
	"credits_used" integer DEFAULT 0 NOT NULL,
	"credits_remaining" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gtm_ai_credit_transaction" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"period_id" text,
	"type" text NOT NULL,
	"amount" integer NOT NULL,
	"related_campaign_id" text,
	"related_prospect_id" text,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "extra_seats" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "gtm_ai_credit_period" ADD CONSTRAINT "gtm_ai_credit_period_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gtm_ai_credit_transaction" ADD CONSTRAINT "gtm_ai_credit_transaction_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gtm_ai_credit_transaction" ADD CONSTRAINT "gtm_ai_credit_transaction_period_id_gtm_ai_credit_period_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."gtm_ai_credit_period"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gtm_ai_credit_transaction" ADD CONSTRAINT "gtm_ai_credit_transaction_related_campaign_id_gtm_outreach_campaign_id_fk" FOREIGN KEY ("related_campaign_id") REFERENCES "public"."gtm_outreach_campaign"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gtm_ai_credit_period_org_idx" ON "gtm_ai_credit_period" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "gtm_ai_credit_period_dates_idx" ON "gtm_ai_credit_period" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "gtm_ai_credit_tx_org_idx" ON "gtm_ai_credit_transaction" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "gtm_ai_credit_tx_period_idx" ON "gtm_ai_credit_transaction" USING btree ("period_id");--> statement-breakpoint
CREATE INDEX "gtm_ai_credit_tx_created_idx" ON "gtm_ai_credit_transaction" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "gtm_ai_credit_tx_campaign_idx" ON "gtm_ai_credit_transaction" USING btree ("related_campaign_id");
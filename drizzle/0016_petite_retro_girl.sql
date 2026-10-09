CREATE TABLE "gtm_conversation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"title" text,
	"type" text DEFAULT 'chat' NOT NULL,
	"outreach_campaign_id" text,
	"research_run_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gtm_message" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"tool_calls" jsonb,
	"artifact" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gtm_conversation" ADD CONSTRAINT "gtm_conversation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gtm_conversation" ADD CONSTRAINT "gtm_conversation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gtm_conversation" ADD CONSTRAINT "gtm_conversation_outreach_campaign_id_gtm_outreach_campaign_id_fk" FOREIGN KEY ("outreach_campaign_id") REFERENCES "public"."gtm_outreach_campaign"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gtm_conversation" ADD CONSTRAINT "gtm_conversation_research_run_id_gtm_research_run_id_fk" FOREIGN KEY ("research_run_id") REFERENCES "public"."gtm_research_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gtm_message" ADD CONSTRAINT "gtm_message_conversation_id_gtm_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."gtm_conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gtm_conv_org_idx" ON "gtm_conversation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "gtm_conv_user_idx" ON "gtm_conversation" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "gtm_conv_type_idx" ON "gtm_conversation" USING btree ("type");--> statement-breakpoint
CREATE INDEX "gtm_conv_updated_idx" ON "gtm_conversation" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "gtm_msg_conv_idx" ON "gtm_message" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "gtm_msg_created_idx" ON "gtm_message" USING btree ("created_at");
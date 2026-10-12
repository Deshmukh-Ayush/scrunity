ALTER TABLE "gtm_email_draft" ADD COLUMN "negotiation_turns" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "gtm_email_event" ADD COLUMN "provider_message_id" text;--> statement-breakpoint
ALTER TABLE "gtm_email_event" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
CREATE INDEX "gtm_email_event_provider_msg_idx" ON "gtm_email_event" USING btree ("provider_message_id");
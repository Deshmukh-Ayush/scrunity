CREATE TABLE "gtm_connected_mailbox" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"provider" text DEFAULT 'gmail' NOT NULL,
	"email" text NOT NULL,
	"encrypted_refresh_token" text NOT NULL,
	"encrypted_access_token" text,
	"access_token_expires_at" timestamp,
	"status" text DEFAULT 'connected' NOT NULL,
	"daily_send_count" integer DEFAULT 0 NOT NULL,
	"last_send_reset_date" text,
	"connected_by" text NOT NULL,
	"connected_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gtm_email_draft" ADD COLUMN "provider_message_id" text;--> statement-breakpoint
ALTER TABLE "gtm_email_draft" ADD COLUMN "sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "gtm_email_draft" ADD COLUMN "error_message" text;--> statement-breakpoint
ALTER TABLE "gtm_connected_mailbox" ADD CONSTRAINT "gtm_connected_mailbox_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gtm_connected_mailbox" ADD CONSTRAINT "gtm_connected_mailbox_connected_by_user_id_fk" FOREIGN KEY ("connected_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gtm_connected_mailbox_org_idx" ON "gtm_connected_mailbox" USING btree ("organization_id");
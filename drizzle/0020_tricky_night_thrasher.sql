CREATE TABLE "gtm_suppression_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text,
	"domain" text NOT NULL,
	"reason" text NOT NULL,
	"source_org_id" text,
	"source_contact_id" text,
	"is_real_send_bounce" boolean DEFAULT false NOT NULL,
	"status_code" text,
	"raw_snippet" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "gtm_suppression_email_idx" ON "gtm_suppression_entry" USING btree ("email");--> statement-breakpoint
CREATE INDEX "gtm_suppression_domain_idx" ON "gtm_suppression_entry" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "gtm_suppression_reason_idx" ON "gtm_suppression_entry" USING btree ("reason");--> statement-breakpoint
CREATE INDEX "gtm_suppression_email_reason_idx" ON "gtm_suppression_entry" USING btree ("email","reason");
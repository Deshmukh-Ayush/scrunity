CREATE TABLE "gtm_email_event" (
	"id" text PRIMARY KEY NOT NULL,
	"email_draft_id" text NOT NULL,
	"type" text NOT NULL,
	"classified_intent" text,
	"raw_snippet" text,
	"occurred_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gtm_meeting" (
	"id" text PRIMARY KEY NOT NULL,
	"contact_id" text NOT NULL,
	"outreach_campaign_id" text,
	"scheduled_at" timestamp NOT NULL,
	"status" text DEFAULT 'booked' NOT NULL,
	"calcom_booking_uid" text,
	"attendee_email" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gtm_email_draft" ADD COLUMN "thread_id" text;--> statement-breakpoint
ALTER TABLE "gtm_email_draft" ADD COLUMN "last_polled_at" timestamp;--> statement-breakpoint
ALTER TABLE "gtm_email_event" ADD CONSTRAINT "gtm_email_event_email_draft_id_gtm_email_draft_id_fk" FOREIGN KEY ("email_draft_id") REFERENCES "public"."gtm_email_draft"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gtm_meeting" ADD CONSTRAINT "gtm_meeting_contact_id_gtm_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."gtm_contact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gtm_meeting" ADD CONSTRAINT "gtm_meeting_outreach_campaign_id_gtm_outreach_campaign_id_fk" FOREIGN KEY ("outreach_campaign_id") REFERENCES "public"."gtm_outreach_campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gtm_email_event_draft_idx" ON "gtm_email_event" USING btree ("email_draft_id");--> statement-breakpoint
CREATE INDEX "gtm_email_event_type_idx" ON "gtm_email_event" USING btree ("type");--> statement-breakpoint
CREATE INDEX "gtm_meeting_contact_idx" ON "gtm_meeting" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "gtm_meeting_campaign_idx" ON "gtm_meeting" USING btree ("outreach_campaign_id");--> statement-breakpoint
CREATE INDEX "gtm_meeting_attendee_email_idx" ON "gtm_meeting" USING btree ("attendee_email");--> statement-breakpoint
CREATE INDEX "gtm_meeting_calcom_uid_idx" ON "gtm_meeting" USING btree ("calcom_booking_uid");--> statement-breakpoint
CREATE INDEX "gtm_email_draft_thread_idx" ON "gtm_email_draft" USING btree ("thread_id");
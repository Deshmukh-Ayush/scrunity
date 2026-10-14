CREATE TABLE "gtm_do_not_contact" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"reason" text NOT NULL,
	"contact_id" text,
	"source_draft_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_usage_counter" (
	"organization_id" text NOT NULL,
	"key" text NOT NULL,
	"window_start" timestamp NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gtm_do_not_contact" ADD CONSTRAINT "gtm_do_not_contact_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gtm_do_not_contact" ADD CONSTRAINT "gtm_do_not_contact_contact_id_gtm_contact_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."gtm_contact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_usage_counter" ADD CONSTRAINT "org_usage_counter_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "gtm_do_not_contact_org_email_unique" ON "gtm_do_not_contact" USING btree ("organization_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "org_usage_counter_org_key_window_unique" ON "org_usage_counter" USING btree ("organization_id","key","window_start");
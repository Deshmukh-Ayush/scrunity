CREATE TABLE "gtm_contact_import" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"uploaded_by_user_id" text,
	"file_name" text NOT NULL,
	"total_rows" integer NOT NULL,
	"imported_count" integer DEFAULT 0 NOT NULL,
	"duplicate_count" integer DEFAULT 0 NOT NULL,
	"invalid_count" integer DEFAULT 0 NOT NULL,
	"suppressed_count" integer DEFAULT 0 NOT NULL,
	"personal_email_count" integer DEFAULT 0 NOT NULL,
	"attested_at" timestamp NOT NULL,
	"attestation_version" text NOT NULL,
	"status" text DEFAULT 'importing' NOT NULL,
	"deleted_at" timestamp,
	"deleted_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gtm_contact_import_row" (
	"id" text PRIMARY KEY NOT NULL,
	"import_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"row_number" integer NOT NULL,
	"email" text,
	"first_name" text,
	"last_name" text,
	"full_name" text,
	"title" text,
	"company_name" text,
	"company_domain" text,
	"website" text,
	"linkedin_url" text,
	"phone" text,
	"city" text,
	"country" text,
	"notes" text,
	"personal_email" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gtm_contact" ADD COLUMN "source_import_id" text;--> statement-breakpoint
ALTER TABLE "gtm_outreach_campaign" ADD COLUMN "source_import_id" text;--> statement-breakpoint
ALTER TABLE "gtm_prospect_company" ADD COLUMN "source_import_id" text;--> statement-breakpoint
ALTER TABLE "gtm_contact_import" ADD CONSTRAINT "gtm_contact_import_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gtm_contact_import" ADD CONSTRAINT "gtm_contact_import_uploaded_by_user_id_user_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gtm_contact_import" ADD CONSTRAINT "gtm_contact_import_deleted_by_user_id_user_id_fk" FOREIGN KEY ("deleted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gtm_contact_import_row" ADD CONSTRAINT "gtm_contact_import_row_import_id_gtm_contact_import_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."gtm_contact_import"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gtm_contact_import_row" ADD CONSTRAINT "gtm_contact_import_row_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gtm_contact_import_org_idx" ON "gtm_contact_import" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "gtm_contact_import_row_import_idx" ON "gtm_contact_import_row" USING btree ("import_id","row_number");--> statement-breakpoint
CREATE INDEX "gtm_contact_import_row_org_email_idx" ON "gtm_contact_import_row" USING btree ("organization_id","email");--> statement-breakpoint
ALTER TABLE "gtm_contact" ADD CONSTRAINT "gtm_contact_source_import_id_gtm_contact_import_id_fk" FOREIGN KEY ("source_import_id") REFERENCES "public"."gtm_contact_import"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gtm_outreach_campaign" ADD CONSTRAINT "gtm_outreach_campaign_source_import_id_gtm_contact_import_id_fk" FOREIGN KEY ("source_import_id") REFERENCES "public"."gtm_contact_import"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gtm_prospect_company" ADD CONSTRAINT "gtm_prospect_company_source_import_id_gtm_contact_import_id_fk" FOREIGN KEY ("source_import_id") REFERENCES "public"."gtm_contact_import"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gtm_contact_source_import_idx" ON "gtm_contact" USING btree ("source_import_id");--> statement-breakpoint
CREATE INDEX "gtm_prospect_company_source_import_idx" ON "gtm_prospect_company" USING btree ("source_import_id");
CREATE TABLE "gtm_provider_connection" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"provider" text NOT NULL,
	"auth_type" text DEFAULT 'api_key' NOT NULL,
	"encrypted_secret" text,
	"secret_last4" text,
	"status" text DEFAULT 'active' NOT NULL,
	"connected_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_verified_at" timestamp,
	"last_error_code" text
);
--> statement-breakpoint
ALTER TABLE "gtm_contact" ADD COLUMN "source_connection_id" text;--> statement-breakpoint
ALTER TABLE "gtm_prospect_company" ADD COLUMN "source_connection_id" text;--> statement-breakpoint
ALTER TABLE "gtm_provider_connection" ADD CONSTRAINT "gtm_provider_connection_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gtm_provider_connection" ADD CONSTRAINT "gtm_provider_connection_connected_by_user_id_user_id_fk" FOREIGN KEY ("connected_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "gtm_provider_connection_org_provider_unique" ON "gtm_provider_connection" USING btree ("organization_id","provider");--> statement-breakpoint
ALTER TABLE "gtm_contact" ADD CONSTRAINT "gtm_contact_source_connection_id_gtm_provider_connection_id_fk" FOREIGN KEY ("source_connection_id") REFERENCES "public"."gtm_provider_connection"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gtm_prospect_company" ADD CONSTRAINT "gtm_prospect_company_source_connection_id_gtm_provider_connection_id_fk" FOREIGN KEY ("source_connection_id") REFERENCES "public"."gtm_provider_connection"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gtm_contact_source_connection_idx" ON "gtm_contact" USING btree ("source_connection_id");--> statement-breakpoint
CREATE INDEX "gtm_prospect_company_source_connection_idx" ON "gtm_prospect_company" USING btree ("source_connection_id");
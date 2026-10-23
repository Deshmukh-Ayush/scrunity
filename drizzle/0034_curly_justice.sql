CREATE TABLE "gtm_company_profile" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"website_url" text NOT NULL,
	"logo_url" text,
	"company_name" text NOT NULL,
	"company_description" text NOT NULL,
	"company_size" text NOT NULL,
	"context_doc" text,
	"context_doc_file_name" text,
	"target_country_code" text NOT NULL,
	"target_region" text,
	"own_arr_amount" bigint,
	"own_arr_currency" text,
	"own_tam_amount" bigint,
	"own_tam_currency" text,
	"research_form_mode" text DEFAULT 'use_saved' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by_user_id" text
);
--> statement-breakpoint
ALTER TABLE "gtm_company_profile" ADD CONSTRAINT "gtm_company_profile_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gtm_company_profile" ADD CONSTRAINT "gtm_company_profile_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "gtm_contact" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "gtm_contact" ADD COLUMN "provider_person_id" text;--> statement-breakpoint
ALTER TABLE "gtm_contact" ADD COLUMN "email_status" text;--> statement-breakpoint
ALTER TABLE "gtm_prospect_company" ADD COLUMN "selection_status" text DEFAULT 'selected' NOT NULL;--> statement-breakpoint
ALTER TABLE "gtm_prospect_company" ADD COLUMN "fit_note" text;--> statement-breakpoint
ALTER TABLE "gtm_prospect_company" ADD COLUMN "decision_maker_status" text;
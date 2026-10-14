CREATE TABLE "pilot_invite" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"plan" text NOT NULL,
	"credits" integer DEFAULT 0 NOT NULL,
	"note" text,
	"status" text DEFAULT 'invited' NOT NULL,
	"claimed_user_id" text,
	"claimed_org_id" text,
	"claim_locked_at" timestamp,
	"plan_applied_at" timestamp,
	"credits_granted_at" timestamp,
	"claimed_at" timestamp,
	"revoked_at" timestamp,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gtm_ai_credit_transaction" ADD COLUMN "created_by_user_id" text;--> statement-breakpoint
ALTER TABLE "gtm_ai_credit_transaction" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "pilot_invite_email_unique" ON "pilot_invite" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "gtm_ai_credit_tx_idempotency_key_unique" ON "gtm_ai_credit_transaction" USING btree ("idempotency_key");
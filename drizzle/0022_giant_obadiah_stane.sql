ALTER TABLE "gtm_connected_mailbox" ALTER COLUMN "encrypted_refresh_token" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "gtm_connected_mailbox" ADD COLUMN "encrypted_password" text;--> statement-breakpoint
ALTER TABLE "gtm_connected_mailbox" ADD COLUMN "metadata" jsonb;
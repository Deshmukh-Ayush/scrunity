CREATE TABLE "gtm_segment_digest" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"icp_segment_id" text NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"metrics" jsonb NOT NULL,
	"summary" text NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gtm_segment_digest" ADD CONSTRAINT "gtm_segment_digest_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gtm_segment_digest" ADD CONSTRAINT "gtm_segment_digest_icp_segment_id_gtm_icp_segment_id_fk" FOREIGN KEY ("icp_segment_id") REFERENCES "public"."gtm_icp_segment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gtm_segment_digest_org_idx" ON "gtm_segment_digest" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "gtm_segment_digest_segment_idx" ON "gtm_segment_digest" USING btree ("icp_segment_id");--> statement-breakpoint
CREATE INDEX "gtm_segment_digest_generated_idx" ON "gtm_segment_digest" USING btree ("generated_at");
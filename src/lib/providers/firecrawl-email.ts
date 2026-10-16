import { lookupWorkEmailBatch } from "@/lib/vendors/firecrawl/email-batch"
import { dbCreditLedger, firecrawlClientDeps } from "@/lib/vendors/firecrawl/runtime"
import { WORK_EMAIL_BATCH_SIZE, WORK_EMAIL_CREDITS_PER_RECORD } from "@/lib/vendors/firecrawl/work-email"
import type { EmailEnrichmentProvider } from "./types"

/** Ref stored on a contact queued for the next batch (no vendor job exists yet). */
export const QUEUED_REF = "queued"

/**
 * Work emails through Firecrawl (PEOPLE_DATA_PROVIDER=firecrawl). Synchronous
 * and batched: `start` only queues a person, and the verified-lead search sends
 * up to 10 queued people per request with `lookupBatch`, one batch per step
 * (lib/pipeline/email-lookup-batch.ts). Logic and verified-only rules live in
 * vendors/firecrawl/email-batch.ts and work-email.ts.
 */
export const firecrawlEmailProvider: EmailEnrichmentProvider = {
  key: "firecrawl",
  maxCreditsPerLookup: WORK_EMAIL_CREDITS_PER_RECORD,
  maxBatchSize: WORK_EMAIL_BATCH_SIZE,
  async start() {
    return { ref: QUEUED_REF }
  },
  async poll() {
    return null
  },
  lookupBatch: (inputs, context) =>
    lookupWorkEmailBatch(inputs, { ledger: dbCreditLedger(context), deps: firecrawlClientDeps() }),
}

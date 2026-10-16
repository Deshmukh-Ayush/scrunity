import { eq } from "drizzle-orm"
import { db } from "@/utils/db"
import { gtmContact } from "@/db/schema"
import type { EmailEnrichmentProvider, EmailLookupInput, VendorSpendContext } from "@/lib/providers/types"
import { LeadSearchStop, saveOutcome, toStop, type LookupMetadata } from "./email-lookup"
import type { Company, Contact } from "./lead-search-state"

/**
 * Email lookups for batch providers (PEOPLE_DATA_PROVIDER=firecrawl). People
 * are queued by startEmailLookup (no call, no credits); each verified-lead
 * search step sends at most one batch of up to `maxBatchSize` queued people,
 * best-fit companies first, so every Inngest step makes at most one request.
 * The wait between batches is the step sleep (GTM_EMAIL_POLL_INTERVAL_MS).
 *
 * A person whose call failed is not retried in this attempt (the search moves
 * on to the next person) and stays open for a later attempt. Once the search
 * has stopped, queued people are released unsent: nothing unpaid is collected.
 */

export interface QueuedLookup {
  contact: Contact
  company: Company
  input: EmailLookupInput
}

const meta = (c: Contact) => (c.enrichMetadata ?? { provider: "firecrawl" }) as LookupMetadata

async function release(contacts: Contact[], skipReason: string, failedAttemptId: string | null) {
  for (const contact of contacts) {
    const metadata: LookupMetadata = { ...meta(contact), startFailedAttemptId: failedAttemptId }
    await db
      .update(gtmContact)
      .set({ emailLookupRef: null, lookupStatus: "lookup_incomplete", skipReason, enrichMetadata: metadata })
      .where(eq(gtmContact.id, contact.id))
  }
}

/** Queued people are released without a call (the search stopped or ran out of time). */
export async function releaseQueued(contacts: Contact[]) {
  await release(contacts, "Not looked up (search budget reached)", null)
}

/**
 * Sends the next batch. Returns how many people were sent and which companies
 * got a verified address. Throws LeadSearchStop when no further lookups can run
 * (cap reached, terms not accepted, out of credits); the batch is then released
 * unsent, so the next step does not try it again.
 */
export async function runEmailBatch({
  queued,
  provider,
  spend,
  attemptId,
  log,
}: {
  queued: QueuedLookup[]
  provider: EmailEnrichmentProvider
  spend: VendorSpendContext
  attemptId: string
  log: (line: string) => void
}): Promise<{ sent: number; verifiedCompanies: Company[] }> {
  if (!provider.lookupBatch || queued.length === 0) return { sent: 0, verifiedCompanies: [] }
  const batch = [...queued]
    .sort((a, b) => (b.company.fitScore ?? -1) - (a.company.fitScore ?? -1))
    .slice(0, provider.maxBatchSize ?? 1)

  let outcomes: Awaited<ReturnType<NonNullable<EmailEnrichmentProvider["lookupBatch"]>>>
  try {
    outcomes = await provider.lookupBatch(batch.map((q) => q.input), spend)
  } catch (err) {
    const stop = toStop(err)
    if (stop) {
      await releaseQueued(batch.map((q) => q.contact))
      throw stop
    }
    log(`email batch of ${batch.length} failed, moving on: ${err instanceof Error ? err.message : "unknown error"}`)
    await release(batch.map((q) => q.contact), "Lookup not finished yet", attemptId)
    return { sent: batch.length, verifiedCompanies: [] }
  }

  const verifiedCompanies: Company[] = []
  let stop: LeadSearchStop | null = null
  for (const [i, { contact, company }] of batch.entries()) {
    const outcome = outcomes[i]
    if (outcome?.result) {
      const r = outcome.result
      await saveOutcome(contact.id, r, { ...meta(contact), provider: provider.key, creditsUsed: r.creditsUsed })
      log(`${contact.name} (${company.domain}): ${r.status}${r.note ? ` (${r.note})` : ""}, ${r.creditsUsed} credit(s)`)
      if (r.status === "verified") verifiedCompanies.push(company)
      continue
    }
    stop ??= toStop(outcome?.error)
    log(`${contact.name} (${company.domain}): lookup failed (${outcome?.error.failureReason ?? "no result"})`)
    await release([contact], "Lookup not finished yet", attemptId)
  }
  if (stop) throw stop
  return { sent: batch.length, verifiedCompanies }
}

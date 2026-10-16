import { z } from "zod"
import { emailMatchesCompanyDomain } from "@/lib/email-verification"
import type { EmailLookupInput, EmailLookupResult } from "@/lib/providers/types"
import { FirecrawlDataError } from "./errors"
import type { AlexandriaCall } from "./client"

/**
 * FullEnrich work email through Firecrawl (capability "contacts/work-email").
 *
 * Documented: one contact per call, options `linkedin_url`, or `first_name` +
 * `last_name` + `domain` (or `company_name`); up to 10 calls per request in the
 * alexandria array, each its own upstream job; 20 credits per record found, an
 * empty `results` array is free. Response data: `{ results: [{ input,
 * contact_info, profile }] }`, contact_info "carries most_probable_work_email
 * and the work_emails candidates", and a found email can be "deliverable,
 * high-probability, or catch-all" (all three billed).
 *
 * NOT documented: the fields inside contact_info, in particular any field that
 * says which of the three an email is. So the verified-only rule is applied
 * strictly: an email is `verified` only when the result carries an explicit
 * status equal to DELIVERABLE (the word FullEnrich's own API uses) and the
 * address is at the prospect company's domain. No status, or any other status,
 * is `unverified` and returns no address. Nothing is guessed.
 */

export const WORK_EMAIL_CAPABILITY = "contacts/work-email"
export const WORK_EMAIL_BATCH_SIZE = 10
export const WORK_EMAIL_CREDITS_PER_RECORD = 20
/** vendorStatus stored when a found email carried no status field at all. */
export const STATUS_NOT_PROVIDED = "STATUS_NOT_PROVIDED"

const DELIVERABLE = "DELIVERABLE"
const NOT_FOUND_STATUSES = new Set(["INVALID", "INVALID_DOMAIN", "NOT_FOUND"])

/** Splits items into batches of at most `size` (one request each). */
export function splitIntoBatches<T>(items: T[], size = WORK_EMAIL_BATCH_SIZE): T[][] {
  if (size < 1) throw new Error("batch size must be at least 1")
  const batches: T[][] = []
  for (let i = 0; i < items.length; i += size) batches.push(items.slice(i, i + size))
  return batches
}

const isLinkedInProfile = (url: string | null | undefined): url is string =>
  Boolean(url && /linkedin\.com\/(in|sales)\//i.test(url))

/** One call: the LinkedIn profile when known, otherwise name + domain (or company name). */
export function workEmailCall(input: EmailLookupInput): AlexandriaCall {
  if (isLinkedInProfile(input.linkedinUrl)) {
    return { provider: "fullenrich", capability: WORK_EMAIL_CAPABILITY, options: { linkedin_url: input.linkedinUrl } }
  }
  const options: Record<string, unknown> = { first_name: input.firstName, last_name: input.lastName }
  if (input.domain) options.domain = input.domain
  else if (input.companyName) options.company_name = input.companyName
  return { provider: "fullenrich", capability: WORK_EMAIL_CAPABILITY, options }
}

const emailEntry = z.union([
  z.string(),
  z.looseObject({
    email: z.string().nullish(),
    status: z.string().nullish(),
    email_status: z.string().nullish(),
  }),
])

const dataSchema = z.looseObject({
  results: z.array(
    z.looseObject({
      contact_info: z
        .looseObject({
          most_probable_work_email: emailEntry.nullish(),
          work_emails: z.array(emailEntry).nullish(),
        })
        .nullish(),
    })
  ),
})

interface Candidate {
  email: string
  status: string | null
}

function toCandidate(entry: z.infer<typeof emailEntry> | null | undefined): Candidate | null {
  if (!entry) return null
  if (typeof entry === "string") return entry.includes("@") ? { email: entry.trim(), status: null } : null
  const email = entry.email?.trim()
  if (!email || !email.includes("@")) return null
  const status = (entry.status ?? entry.email_status)?.trim().toUpperCase() || null
  return { email, status }
}

/**
 * One work-email `data` payload -> verified / unverified / not_found for this
 * person. Throws when the payload has no `results` array at all.
 */
export function parseWorkEmailData(data: unknown, input: EmailLookupInput, creditsCost: number): EmailLookupResult {
  const parsed = dataSchema.safeParse(data)
  if (!parsed.success) {
    throw new FirecrawlDataError("provider_request_failed", "work email data without a results array", null, "unknown")
  }
  const base = { vendor: "firecrawl", creditsUsed: creditsCost }
  const info = parsed.data.results[0]?.contact_info
  const candidates = [toCandidate(info?.most_probable_work_email), ...(info?.work_emails ?? []).map(toCandidate)].filter(
    (c): c is Candidate => c !== null
  )
  if (candidates.length === 0) return { ...base, email: null, status: "not_found", vendorStatus: null }

  const atCompany = candidates.filter((c) => emailMatchesCompanyDomain(c.email, input.domain))
  if (atCompany.length === 0) {
    return { ...base, email: null, status: "not_found", vendorStatus: candidates[0].status, note: "email_at_other_company" }
  }
  const deliverable = atCompany.find((c) => c.status === DELIVERABLE)
  if (deliverable) return { ...base, email: deliverable.email, status: "verified", vendorStatus: DELIVERABLE }

  const best = atCompany[0]
  if (best.status && NOT_FOUND_STATUSES.has(best.status)) {
    return { ...base, email: null, status: "not_found", vendorStatus: best.status }
  }
  // HIGH_PROBABILITY, CATCH_ALL, unknown, or no status at all: the mailbox was not proven.
  return { ...base, email: null, status: "unverified", vendorStatus: best.status ?? STATUS_NOT_PROVIDED }
}

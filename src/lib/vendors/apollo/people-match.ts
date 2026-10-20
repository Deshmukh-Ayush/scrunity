import { z } from "zod"
import { emailMatchesCompanyDomain } from "@/lib/email-verification"
import type { BatchLookupOutcome, EmailLookupInput, EmailLookupResult } from "@/lib/providers/types"
import { APOLLO_VERIFIED_STATUS, BULK_MATCH_MAX_PEOPLE, PEOPLE_MATCH_CREDITS_PER_PERSON } from "./constants"
import { ApolloError } from "./errors"

/**
 * Apollo bulk people enrichment (POST /api/v1/people/bulk_match): reveals up
 * to 10 people found by the people search, by their Apollo id, and with them
 * the work email and Apollo's email_status.
 *
 * Verified-only, the same rule as every other provider
 * (lib/email-verification.ts): an address counts only with Apollo's explicit
 * "verified" status AND at the prospect company's own domain. Any other
 * status, a missing status, or an address at another domain stores no email.
 *
 * Apollo does not document that `matches` follows the request order, so
 * results are joined to the request by person id.
 */

export function buildBulkMatchBody(inputs: EmailLookupInput[]) {
  if (inputs.length === 0 || inputs.length > BULK_MATCH_MAX_PEOPLE) {
    throw new Error(`bulk_match takes 1-${BULK_MATCH_MAX_PEOPLE} people, got ${inputs.length}`)
  }
  return {
    details: inputs.map((input) =>
      input.providerPersonId
        ? { id: input.providerPersonId }
        : { first_name: input.firstName, last_name: input.lastName, domain: input.domain }
    ),
  }
}

/** Query flags: never reveal personal emails or phones (both can cost extra credits). */
export function bulkMatchQuery(): URLSearchParams {
  return new URLSearchParams({ reveal_personal_emails: "false", reveal_phone_number: "false" })
}

const matchSchema = z.looseObject({
  id: z.string().nullish(),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  title: z.string().nullish(),
  linkedin_url: z.string().nullish(),
  email: z.string().nullish(),
  email_status: z.string().nullish(),
})

const bodySchema = z.looseObject({
  matches: z.array(z.unknown().nullable()).nullish(),
  credits_consumed: z.number().nonnegative().nullish(),
})

type Match = z.infer<typeof matchSchema>

function toResult(match: Match | null, input: EmailLookupInput, creditsUsed: number): EmailLookupResult {
  const base = { vendor: "apollo", creditsUsed }
  if (!match) return { ...base, email: null, status: "not_found", vendorStatus: null }
  const revealed =
    match.first_name && match.last_name
      ? {
          firstName: match.first_name.trim(),
          lastName: match.last_name.trim(),
          title: match.title?.trim() || null,
          linkedinUrl: match.linkedin_url?.trim() || null,
        }
      : null
  const email = match.email?.trim() || null
  const status = match.email_status?.trim().toLowerCase() || null
  if (!email || !email.includes("@")) {
    return { ...base, email: null, status: "not_found", vendorStatus: status, revealed }
  }
  if (!emailMatchesCompanyDomain(email, input.domain)) {
    return { ...base, email: null, status: "not_found", vendorStatus: status, note: "email_at_other_company", revealed }
  }
  if (status === APOLLO_VERIFIED_STATUS) {
    return { ...base, email, status: "verified", vendorStatus: status, revealed }
  }
  return { ...base, email: null, status: "unverified", vendorStatus: status ?? "status_not_provided", revealed }
}

/**
 * One bulk_match body -> one outcome per input, in input order, plus the
 * credits Apollo reported. Throws (as possibly charged) when the body has no
 * `matches` array at all.
 */
export function parseBulkMatch(body: unknown, inputs: EmailLookupInput[]): { outcomes: BatchLookupOutcome[]; creditsCost: number } {
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success || !parsed.data.matches) {
    throw new ApolloError("apollo_request_failed", 200, "unknown")
  }
  const byId = new Map<string, Match>()
  for (const raw of parsed.data.matches) {
    const match = matchSchema.safeParse(raw)
    if (match.success && match.data.id) byId.set(match.data.id, match.data)
  }
  const matched = inputs.map((input, i) => {
    if (input.providerPersonId) return byId.get(input.providerPersonId) ?? null
    // Inputs without an id (not produced by the Apollo search) fall back to position.
    const positional = matchSchema.safeParse(parsed.data.matches?.[i])
    return positional.success ? positional.data : null
  })
  const matchedCount = matched.filter(Boolean).length
  const creditsCost = parsed.data.credits_consumed ?? matchedCount * PEOPLE_MATCH_CREDITS_PER_PERSON
  const outcomes = matched.map(
    (match, i): BatchLookupOutcome => ({
      result: toResult(match, inputs[i], match ? PEOPLE_MATCH_CREDITS_PER_PERSON : 0),
      error: null,
    })
  )
  return { outcomes, creditsCost }
}

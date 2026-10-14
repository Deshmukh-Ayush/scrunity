/**
 * What pipeline rows look like to customers. Vendor identity (provider names,
 * provider ids, vendor credit balances, raw provider payloads, vendor-named
 * counters and failure codes) never leaves the server.
 */

const VENDOR_NAME = /firecrawl|apollo|fullenrich|enrich\.so|\benrich\b|groq|dodo|resend|cal\.com/i

/** Internal failure codes -> neutral codes the UI maps to text. */
const FAILURE_CODES: Record<string, string> = {
  firecrawl_call_cap_exceeded: "web_search_attempt_limit",
  firecrawl_lifetime_cap_exceeded: "web_search_total_limit",
  firecrawl_org_daily_cap_exceeded: "web_search_daily_limit",
  paused_firecrawl_allotment_exhausted: "web_search_monthly_limit",
  provider_credit_cap_reached: "company_search_monthly_limit",
  provider_credits_exhausted: "company_search_unavailable",
  people_provider_unavailable: "people_search_unavailable",
}

const GENERIC_FAILURE = "This step failed. Retry it, or contact support if it keeps failing."

export function toPublicFailureReason(reason: string | null | undefined): string | null {
  if (!reason) return reason ?? null
  if (FAILURE_CODES[reason]) return FAILURE_CODES[reason]
  return VENDOR_NAME.test(reason) ? GENERIC_FAILURE : reason
}

/** `enrich_verified` names the email vendor; customers see `verified`. */
export function toPublicEmailStatus<T extends string | null | undefined>(value: T): T | "verified" {
  return value === "enrich_verified" ? "verified" : value
}

const HIDDEN_RUN_FIELDS = ["firecrawlCallCount", "firecrawlAttemptCallCount"]
const HIDDEN_CONTACT_FIELDS = ["source", "providerId", "providerPersonId", "enrichMetadata"]

function omit<T extends object>(row: T, keys: string[]) {
  return Object.fromEntries(Object.entries(row).filter(([k]) => !keys.includes(k)))
}

/** A research run or campaign row: no vendor-named counters, neutral failure reason. */
export function publicPipelineRow<T extends { failureReason?: string | null }>(row: T) {
  return { ...omit(row, HIDDEN_RUN_FIELDS), failureReason: toPublicFailureReason(row.failureReason) } as Omit<
    T,
    "firecrawlCallCount" | "firecrawlAttemptCallCount"
  >
}

/** A contact or company row: no provider ids, no vendor payload, neutral email status. */
export function publicContactRow<T extends object>(row: T) {
  const out = omit(row, HIDDEN_CONTACT_FIELDS) as Record<string, unknown>
  if ("emailSource" in out) out.emailSource = toPublicEmailStatus(out.emailSource as string | null)
  if ("verificationStatus" in out) out.verificationStatus = toPublicEmailStatus(out.verificationStatus as string | null)
  return out as Omit<T, "source" | "providerId" | "providerPersonId" | "enrichMetadata">
}

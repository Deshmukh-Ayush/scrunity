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
  email_provider_unavailable: "email_lookup_unavailable",
  email_credit_cap_reached: "email_lookup_monthly_limit",
  email_credits_exhausted: "email_lookup_unavailable",
  email_run_budget: "email_lookup_run_limit",
  companies_examined_budget: "companies_examined_limit",
  wall_clock_budget: "time_limit",
}

const GENERIC_FAILURE = "This step failed. Retry it, or contact support if it keeps failing."

export function toPublicFailureReason(reason: string | null | undefined): string | null {
  if (!reason) return reason ?? null
  if (FAILURE_CODES[reason]) return FAILURE_CODES[reason]
  return VENDOR_NAME.test(reason) ? GENERIC_FAILURE : reason
}

/**
 * Customer-facing email status. `mailbox_verified` is shown as `verified`.
 * `enrich_verified` (legacy, names a vendor) is not mailbox-verified under the
 * verified-only policy (lib/email-verification.ts), so it is shown as
 * `unverified`; `vendor_lookup` (an email source) is shown as `email_lookup`.
 */
export function toPublicEmailStatus<T extends string | null | undefined>(
  value: T
): T | "verified" | "unverified" | "email_lookup" {
  if (value === "mailbox_verified") return "verified"
  if (value === "enrich_verified") return "unverified"
  if (value === "vendor_lookup") return "email_lookup"
  return value
}

const HIDDEN_RUN_FIELDS = ["firecrawlCallCount", "firecrawlAttemptCallCount", "stageTimings"]
const HIDDEN_CONTACT_FIELDS = ["source", "providerId", "providerPersonId", "enrichMetadata", "emailLookupRef"]

function omit<T extends object>(row: T, keys: string[]) {
  return Object.fromEntries(Object.entries(row).filter(([k]) => !keys.includes(k)))
}

/** The verified-lead search ending without vendor credits or internal stop codes. */
function publicLeadSearchOutcome(value: unknown) {
  if (!value || typeof value !== "object") return value ?? null
  const rest = omit(value, ["emailCreditsUsed", "stopReason"])
  const stopReason = (value as { stopReason?: string | null }).stopReason
  return { ...rest, stopReason: toPublicFailureReason(stopReason) }
}

/** A research run or campaign row: no vendor-named counters, neutral failure reason. */
export function publicPipelineRow<T extends { failureReason?: string | null }>(row: T) {
  const out: Record<string, unknown> = {
    ...omit(row, HIDDEN_RUN_FIELDS),
    failureReason: toPublicFailureReason(row.failureReason),
  }
  if ("leadSearchOutcome" in out) out.leadSearchOutcome = publicLeadSearchOutcome(out.leadSearchOutcome)
  return out as Omit<T, "firecrawlCallCount" | "firecrawlAttemptCallCount" | "stageTimings">
}

/** A contact or company row: no provider ids, no vendor payload, neutral email status. */
export function publicContactRow<T extends object>(row: T) {
  const out = omit(row, HIDDEN_CONTACT_FIELDS) as Record<string, unknown>
  const verified = out.verificationStatus === "mailbox_verified"
  // A mailbox-verified contact reads as "verified" wherever the UI shows the source.
  if ("emailSource" in out) {
    out.emailSource = verified ? "verified" : toPublicEmailStatus(out.emailSource as string | null)
  }
  if ("verificationStatus" in out) out.verificationStatus = toPublicEmailStatus(out.verificationStatus as string | null)
  return out as Omit<T, "source" | "providerId" | "providerPersonId" | "enrichMetadata" | "emailLookupRef">
}

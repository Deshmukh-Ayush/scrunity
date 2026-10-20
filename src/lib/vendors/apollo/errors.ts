/**
 * Apollo failures mapped to neutral codes. `failureReason` is what a stage
 * stores on its row; customers see it through lib/data/public-fields.ts.
 *
 * Messages never contain the API key or Apollo's raw response body (which can
 * echo request details): only the status and a fixed description.
 */

export type ApolloFailure =
  /** 401, or 403 that is not about the plan: the key is wrong or revoked. */
  | "apollo_key_invalid"
  /** 403 whose message says the plan does not include this endpoint. */
  | "apollo_plan_blocked"
  /** 402, or a message about credits: the customer's account is out of credits. */
  | "apollo_credits_exhausted"
  /** Still 429 after the client's retries. */
  | "apollo_rate_limited"
  /** Any other status, a timeout or an unreadable response. */
  | "apollo_request_failed"

export class ApolloError extends Error {
  constructor(
    public readonly failureReason: ApolloFailure,
    public readonly status: number | null,
    /**
     * "unknown" when the request reached Apollo and may have been billed (a
     * timeout after sending, an unreadable 200), so a reservation is kept.
     */
    public readonly charged: "none" | "unknown" = "none"
  ) {
    super(`Apollo request failed (${failureReason}${status ? `, HTTP ${status}` : ""})`)
    this.name = "ApolloError"
  }
}

/** Plan restrictions as Apollo words them, e.g. "not accessible with this api_key on a free plan". */
const PLAN_WORDS = /\b(plan|upgrade|not included|free tier)\b/i
const CREDIT_WORDS = /\b(credit|credits|insufficient)\b/i

/**
 * Status (and the error text Apollo sent, read only to classify it) to a
 * failure. The text is never stored or rethrown.
 */
export function apolloFailureFor(status: number, errorText: string): ApolloFailure {
  if (status === 402 || (status === 422 && CREDIT_WORDS.test(errorText))) return "apollo_credits_exhausted"
  if (status === 429) return "apollo_rate_limited"
  if (status === 401) return "apollo_key_invalid"
  if (status === 403) {
    if (CREDIT_WORDS.test(errorText)) return "apollo_credits_exhausted"
    return PLAN_WORDS.test(errorText) ? "apollo_plan_blocked" : "apollo_key_invalid"
  }
  return "apollo_request_failed"
}

/** Failures that mean the stored key can no longer be used until the customer reconnects. */
export function invalidatesConnection(failure: ApolloFailure): boolean {
  return failure === "apollo_key_invalid"
}

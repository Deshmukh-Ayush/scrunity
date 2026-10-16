/**
 * Firecrawl data (Alexandria) failures, mapped to the app's neutral failure
 * codes. `failureReason` is what a stage stores on its row; the customer sees
 * it only through lib/data/public-fields.ts, which never names a vendor.
 *
 * Documented by Firecrawl: THIRD_PARTY_DATA_TERMS_REQUIRED with
 * requiresAction.url (an org admin must accept the provider's terms). Other
 * error codes are not documented, so everything else is mapped from the HTTP
 * status, plus a loose match on the error code text.
 */

export type FirecrawlDataFailure =
  /** An admin has not accepted the data provider's terms yet. */
  | "data_terms_required"
  /** The Firecrawl account is out of credits (HTTP 402). */
  | "data_credits_exhausted"
  /** Still rate-limited after the client's backoff retries. */
  | "provider_rate_limited"
  /** Missing or rejected API key (HTTP 401/403). */
  | "provider_access_denied"
  /** Bad request, server error or a response we could not read. */
  | "provider_request_failed"

export const TERMS_REQUIRED_CODE = "THIRD_PARTY_DATA_TERMS_REQUIRED"

export class FirecrawlDataError extends Error {
  constructor(
    public readonly failureReason: FirecrawlDataFailure,
    detail: string,
    /** Where an admin accepts the terms. Server-side only, never shown to customers. */
    public readonly requiresActionUrl: string | null = null,
    /**
     * "unknown" when the request reached Firecrawl and may have been billed
     * (e.g. a 200 we could not parse), so the ledger keeps the reservation.
     */
    public readonly charged: "none" | "unknown" = "none"
  ) {
    super(`Firecrawl data request failed (${failureReason}): ${detail}`)
    this.name = "FirecrawlDataError"
  }
}

/** Failure for an HTTP status that has no more specific error code. */
export function failureForStatus(status: number): FirecrawlDataFailure {
  if (status === 402) return "data_credits_exhausted"
  if (status === 429) return "provider_rate_limited"
  if (status === 401 || status === 403) return "provider_access_denied"
  return "provider_request_failed"
}

/** Failure for an error code string (top-level or per call), falling back to the status. */
export function failureForCode(code: string | null | undefined, status = 0): FirecrawlDataFailure {
  const upper = (code ?? "").toUpperCase()
  if (upper === TERMS_REQUIRED_CODE || upper.includes("TERMS")) return "data_terms_required"
  if (upper.includes("RATE") || upper.includes("TOO_MANY")) return "provider_rate_limited"
  if (upper.includes("CREDIT") || upper.includes("PAYMENT") || upper.includes("INSUFFICIENT")) {
    return "data_credits_exhausted"
  }
  return failureForStatus(status)
}

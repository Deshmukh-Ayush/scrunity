/**
 * Vendor-neutral shapes for company-database providers. Pipeline code depends
 * only on these, so a different vendor can replace Apollo without touching it.
 */

/** One company as a provider describes it. Unknown fields are null, never guessed. */
export interface NormalizedCompany {
  providerId: string
  name: string
  domain: string | null
  website: string | null
  linkedinUrl: string | null
  country: string | null
  state: string | null
  city: string | null
  industry: string | null
  headcount: number | null
  /** Exactly as the provider prints it (e.g. "24.8M"), or null. */
  revenueRange: string | null
  description: string | null
  /** Provider key, e.g. "apollo". */
  source: string
}

export interface CompanyDiscoveryQuery {
  /** Country name in English, e.g. "India". */
  country: string
  /** State, region or city within the country. Omit for the whole country. */
  state?: string | null
  keywords: string[]
  headcountRange?: { min: number; max: number } | null
  limit: number
}

/** Who the spend is attributed to in the vendor ledger. */
export interface VendorSpendContext {
  organizationId?: string | null
  researchRunId?: string | null
  campaignId?: string | null
}

export interface CompanyDiscoveryResult {
  companies: NormalizedCompany[]
  /** Total matches the provider reports for these filters, when it says. */
  totalAvailable: number | null
  creditsUsed: number
}

export interface CompanyDiscoveryProvider {
  readonly key: string
  searchCompanies(
    query: CompanyDiscoveryQuery,
    context: VendorSpendContext
  ): Promise<CompanyDiscoveryResult>
}

/** One decision maker as a provider describes them. No email here: that is a later lookup. */
export interface NormalizedPerson {
  providerPersonId: string
  firstName: string
  lastName: string
  title: string | null
  linkedinUrl: string | null
  /** "City, State, Country" as far as the provider knows it, or null. */
  location: string | null
  /** Provider key, e.g. "fixture". */
  source: string
}

export interface DecisionMakerQuery {
  company: { name: string; domain: string; providerId: string | null }
  /** Job titles to search for, most important first. */
  titles: string[]
  /** Person-location filter, from the campaign target market. */
  country: string
  state?: string | null
  limit: number
}

export interface DecisionMakerResult {
  people: NormalizedPerson[]
  creditsUsed: number
}

export interface PeopleDiscoveryProvider {
  readonly key: string
  findDecisionMakers(
    query: DecisionMakerQuery,
    context: VendorSpendContext
  ): Promise<DecisionMakerResult>
}

/** No live people vendor is configured; database-mode Stage 5 cannot run outside fixture mode. */
export class PeopleProviderUnavailableError extends Error {
  public readonly failureReason = "people_provider_unavailable"
  constructor(key: string) {
    super(
      `No live decision-maker provider is available (GTM_PEOPLE_PROVIDER="${key}").`
    )
    this.name = "PeopleProviderUnavailableError"
  }
}

/**
 * The call would push this month's vendor spend past its cap. Thrown before any
 * network request. `failureReason` is what the pipeline stores on the row.
 */
export class VendorCreditCapError extends Error {
  public readonly failureReason = "provider_credit_cap_reached"
  constructor(
    public readonly vendor: string,
    public readonly used: number,
    public readonly cap: number,
    public readonly requested: number
  ) {
    super(
      `${vendor} monthly credit cap reached: ${used} of ${cap} credits used this month, call needs ${requested}.`
    )
    this.name = "VendorCreditCapError"
  }
}

/** The vendor answered HTTP 402: the account itself is out of credits. */
export class VendorCreditsExhaustedError extends Error {
  public readonly failureReason = "provider_credits_exhausted"
  constructor(public readonly vendor: string) {
    super(`${vendor} reports the account is out of credits (HTTP 402).`)
    this.name = "VendorCreditsExhaustedError"
  }
}

/** Any other failed vendor call (auth, plan access, rate limit after one retry, 5xx). */
export class VendorRequestError extends Error {
  public readonly failureReason: string
  constructor(
    public readonly vendor: string,
    public readonly status: number,
    detail: string
  ) {
    super(`${vendor} request failed (HTTP ${status}): ${detail}`)
    this.name = "VendorRequestError"
    this.failureReason =
      status === 429
        ? "provider_rate_limited"
        : status === 401 || status === 403
          ? "provider_access_denied"
          : "provider_request_failed"
  }
}

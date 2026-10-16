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
  /** Free-text headquarters location, when the provider gives one string instead of parts. */
  location?: string | null
  /** Decision makers the search already found here (people-search providers only). */
  people?: NormalizedPerson[]
}

/** People-search filters (PEOPLE_DATA_PROVIDER=firecrawl). */
export interface PeopleSearchFilters {
  titles: string[]
  seniority: string[]
  /** person_locations values, e.g. "Madhya Pradesh, India". */
  locations: string[]
  industries: string[]
  headcountMin: number | null
  headcountMax: number | null
}

export interface CompanyDiscoveryQuery {
  /** Country name in English, e.g. "India". */
  country: string
  /** State, region or city within the country. Omit for the whole country. */
  state?: string | null
  keywords: string[]
  /** Companies tagged, named or described with any of these are excluded. */
  excludeKeywords?: string[]
  /** Exact provider industry names (lib/providers/industries.ts); any one matches. */
  industries?: string[]
  headcountRange?: { min: number; max: number } | null
  limit: number
  /** People-search providers search people with these filters and group them by company. */
  people?: PeopleSearchFilters
  /** People-search providers: most people to read (each one is billed). */
  candidateCap?: number
  /** People-search providers: personKeys of people the organization already has; they are dropped. */
  excludePersonKeys?: ReadonlySet<string>
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
  /** People-search providers: what was dropped before grouping, for the gate's note. */
  skipped?: { noCompanyDomain: number; duplicates: number; alreadyKnown: number }
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
  /** Retry pass: slower, more patient rate-limit handling (web provider only). */
  patient?: boolean
}

export interface DecisionMakerResult {
  people: NormalizedPerson[]
  creditsUsed: number
  /**
   * True when a lookup was still rate-limited, so "nobody found" is not known
   * yet. The verified-lead search retries such a company once at the end.
   */
  incomplete?: boolean
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
 * The call would push this month's vendor spend (or, scope "run", this
 * campaign's) past its cap. Thrown before any network request. `failureReason`
 * is what the pipeline stores on the row.
 */
export class VendorCreditCapError extends Error {
  public readonly failureReason: "provider_credit_cap_reached" | "provider_run_credit_cap_reached"
  constructor(
    public readonly vendor: string,
    public readonly used: number,
    public readonly cap: number,
    public readonly requested: number,
    public readonly scope: "monthly" | "run" = "monthly"
  ) {
    super(
      scope === "run"
        ? `${vendor} per-campaign credit cap reached: ${used} of ${cap} credits used by this campaign, call needs ${requested}.`
        : `${vendor} monthly credit cap reached: ${used} of ${cap} credits used this month, call needs ${requested}.`
    )
    this.name = "VendorCreditCapError"
    this.failureReason = scope === "run" ? "provider_run_credit_cap_reached" : "provider_credit_cap_reached"
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

/** One person whose work email should be found and verified. */
export interface EmailLookupInput {
  firstName: string
  lastName: string
  /** The company we are prospecting; the result must be at this domain. */
  domain: string
  companyName?: string | null
  linkedinUrl?: string | null
}

/**
 * The outcome of one email lookup. `verified` only when the vendor checked the
 * mailbox itself (see lib/email-verification.ts); `email` is null otherwise, so
 * an unverified address can never be stored or sent to.
 */
export interface EmailLookupResult {
  email: string | null
  status: "verified" | "unverified" | "not_found"
  vendor: string
  creditsUsed: number
  /** The vendor's own status word (e.g. DELIVERABLE, CATCH_ALL), kept server-side. */
  vendorStatus: string | null
  /** Why an address the vendor found was not accepted, e.g. a different company's domain. */
  note?: string | null
}

/**
 * Email-enrichment vendor. Lookups are asynchronous: `start` submits one person
 * (the only call that can cost credits) and returns a job reference that is
 * stored before polling; `poll` reads that job (free) until it has a result.
 */
export interface EmailEnrichmentProvider {
  readonly key: string
  /** Credits one lookup can cost at most; reserved in the ledger before `start`. */
  readonly maxCreditsPerLookup: number
  start(input: EmailLookupInput): Promise<{ ref: string }>
  /** null while the vendor is still working. */
  poll(ref: string, input: EmailLookupInput): Promise<EmailLookupResult | null>
  /**
   * Batch providers answer synchronously: `start` only queues a person (no
   * call, no credits) and the verified-lead search sends queued people in
   * batches of `maxBatchSize`, one batch per step. The provider reserves and
   * settles its own credits.
   */
  readonly maxBatchSize?: number
  lookupBatch?(inputs: EmailLookupInput[], context: VendorSpendContext): Promise<BatchLookupOutcome[]>
}

/** One person's result in a batch: a result, or the error of that one call. */
export type BatchLookupOutcome =
  | { result: EmailLookupResult; error: null }
  | { result: null; error: Error & { failureReason: string } }

/** No email vendor is configured (missing API key). Never falls back to guessing. */
export class EmailProviderUnavailableError extends Error {
  public readonly failureReason = "email_provider_unavailable"
  constructor(detail: string) {
    super(`Email lookup is not available: ${detail}`)
    this.name = "EmailProviderUnavailableError"
  }
}

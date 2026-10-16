/**
 * Environment switches for the company-database pipeline. Read on every call
 * (not at import) so scripts can change them between runs.
 */

/** `fixture` serves recorded responses and makes zero network calls. */
export function getProviderMode(): "live" | "fixture" {
  return process.env.GTM_PROVIDER_MODE === "fixture" ? "fixture" : "live"
}

/**
 * Where people and email data come from. `firecrawl` (default): people search
 * and work emails through Firecrawl's data API, with the company-selection gate.
 * `legacy`: the previous vendors and switches (GTM_DISCOVERY_MODE,
 * GTM_COMPANY_PROVIDER, GTM_PEOPLE_PROVIDER, GTM_EMAIL_PROVIDER), kept for one
 * release so the old path can be restored.
 */
export function getPeopleDataProvider(): "firecrawl" | "legacy" {
  return process.env.PEOPLE_DATA_PROVIDER === "legacy" ? "legacy" : "firecrawl"
}

const usesFirecrawlData = () => getPeopleDataProvider() === "firecrawl"

/**
 * `database`: Stage 4 searches a data provider and stops at the company
 * selection gate (always the case with PEOPLE_DATA_PROVIDER=firecrawl).
 * `legacy`: the old Firecrawl web-search Stage 4.
 */
export function getDiscoveryMode(): "database" | "legacy" {
  if (usesFirecrawlData()) return "database"
  return process.env.GTM_DISCOVERY_MODE === "database" ? "database" : "legacy"
}

/** Which company-discovery provider to use: "firecrawl" (people search), or "apollo" in legacy mode. */
export function getCompanyProviderKey(): string {
  if (usesFirecrawlData()) return "firecrawl"
  return process.env.GTM_COMPANY_PROVIDER || "apollo"
}

/** Firecrawl data credits allowed per calendar month (UTC), all campaigns together. Default 3000. */
export function getFirecrawlMonthlyCreditCap(): number {
  return intEnv("FIRECRAWL_MONTHLY_CREDIT_CAP", 3000, 0, 1_000_000)
}

/**
 * Firecrawl data credits one campaign may spend across all its attempts.
 * Default 1200: a full people search at the default candidate cap (150 x 5 =
 * 750) plus 20 work-email lookups (20 x 20 = 400) and some headroom.
 */
export function getFirecrawlRunCreditCap(): number {
  return intEnv("FIRECRAWL_RUN_CREDIT_CAP", 1200, 0, 100_000)
}

/** People one campaign's search reads at most (6 per page, 5 credits each). Default 150, ceiling 600. */
export function getPeopleSearchCandidateCap(): number {
  return intEnv("GTM_PEOPLE_SEARCH_CANDIDATE_CAP", 150, 1, 600)
}

const MAX_COMPANIES_DEFAULT = 15
const MAX_COMPANIES_CEILING = 25

/** Companies per Stage 4 run: env value, default 15, never above 25. */
export function getMaxCompaniesPerRun(): number {
  const parsed = parseInt(process.env.GTM_MAX_COMPANIES_PER_RUN ?? "", 10)
  const value =
    Number.isFinite(parsed) && parsed > 0 ? parsed : MAX_COMPANIES_DEFAULT
  return Math.min(value, MAX_COMPANIES_CEILING)
}

/** Apollo credits we allow ourselves per calendar month (UTC). Default 60. */
export function getApolloMonthlyCreditCap(): number {
  const parsed = parseInt(process.env.APOLLO_MONTHLY_CREDIT_CAP ?? "", 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 60
}

/**
 * Which decision-maker provider Stage 5 uses. With PEOPLE_DATA_PROVIDER=firecrawl
 * it is always "stored" (the people Stage 4's people search found). Legacy:
 * "web" (Firecrawl LinkedIn/team-page search, providers/people-web.ts) or
 * "fixture" (synthetic people, fixture mode only). Default: "fixture" in fixture mode,
 * "web" otherwise.
 */
export function getPeopleProviderKey(): string {
  // Firecrawl mode: people come from Stage 4's people search, stored per company.
  if (usesFirecrawlData()) return "stored"
  return process.env.GTM_PEOPLE_PROVIDER || (getProviderMode() === "fixture" ? "fixture" : "web")
}

/** Decision makers stored per selected company: default 1, maximum 2. */
export function getDecisionMakersPerCompany(): number {
  const parsed = parseInt(process.env.GTM_DECISION_MAKERS_PER_COMPANY ?? "", 10)
  const value = Number.isFinite(parsed) && parsed > 0 ? parsed : 1
  return Math.min(value, 2)
}

const intEnv = (name: string, fallback: number, min: number, max: number) => {
  const parsed = parseInt(process.env[name] ?? "", 10)
  const value = Number.isFinite(parsed) && parsed >= min ? parsed : fallback
  return Math.min(value, max)
}

/** Which email-enrichment vendor finds and verifies addresses: "firecrawl", or "fullenrich" in legacy mode. */
export function getEmailProviderKey(): string {
  if (usesFirecrawlData()) return "firecrawl"
  return process.env.GTM_EMAIL_PROVIDER || "fullenrich"
}

/** FullEnrich credits we allow ourselves per calendar month (UTC). Default 45. */
export function getFullEnrichMonthlyCreditCap(): number {
  return intEnv("FULLENRICH_MONTHLY_CREDIT_CAP", 45, 0, 100_000)
}

/** Verified leads one campaign searches for: default 10, never above 15. */
export function getTargetVerifiedLeads(campaignOverride?: number | null): number {
  if (campaignOverride && campaignOverride > 0) return Math.min(campaignOverride, 15)
  return intEnv("GTM_TARGET_VERIFIED_LEADS", 10, 1, 15)
}

/** Decision makers tried per company before moving on: default 3, maximum 5. */
export function getMaxCandidatesPerCompany(): number {
  return intEnv("GTM_MAX_CANDIDATES_PER_COMPANY", 3, 1, 5)
}

/**
 * Companies the verified-lead search may examine per attempt: default 15
 * (the most one database-mode search returns), ceiling 60. With the web people
 * provider the per-attempt Firecrawl cap (35) also bounds it: the search only
 * starts a company while 3 calls (its worst case) are left, so it examines at
 * least 11 and typically all 15 (LinkedIn search first: 1 call when it finds
 * someone). Companies it never reaches are marked "not reached".
 */
export function getMaxCompaniesExamined(): number {
  return intEnv("GTM_MAX_COMPANIES_EXAMINED", 15, 1, 60)
}

/**
 * Email lookups (each can cost at most one vendor credit) per campaign, across
 * restarts: default 20, ceiling 45. Counted from stored lookups, so a restart
 * never gets a fresh budget.
 */
export function getEmailLookupsPerCampaign(): number {
  return intEnv("GTM_EMAIL_LOOKUPS_PER_CAMPAIGN", 20, 0, 45)
}

/**
 * Wall-clock limit of one verified-lead search attempt, in ms, measured from
 * the stage claim across all its steps (no single step runs long). Default 20
 * min, max 60. After it, no new company or lookup starts; lookups already paid
 * for are still polled to their result (each at most
 * GTM_EMAIL_LOOKUP_MAX_WAIT_SECONDS).
 */
export function getLeadSearchMaxMs(): number {
  return intEnv("GTM_LEAD_SEARCH_MAX_MINUTES", 20, 1, 60) * 60_000
}

/** Companies processed at the same time (each still tries its people one by one). Default 3. */
export function getLeadSearchConcurrency(): number {
  return intEnv("GTM_LEAD_SEARCH_CONCURRENCY", 3, 1, 5)
}

/** Longest wait for one email lookup's result before it is left incomplete. Default 180 s. */
export function getEmailLookupMaxWaitMs(): number {
  return intEnv("GTM_EMAIL_LOOKUP_MAX_WAIT_SECONDS", 180, 10, 600) * 1000
}

/**
 * Seconds between polls of a live email lookup, as milliseconds. Default 15 s
 * (FullEnrich jobs usually finish in 30-90 s). Tests with a local vendor stub
 * set GTM_EMAIL_POLL_INTERVAL_MS low.
 */
export function getEmailPollIntervalMs(): number {
  return intEnv("GTM_EMAIL_POLL_INTERVAL_MS", 15_000, 0, 120_000)
}

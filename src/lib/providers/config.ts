/**
 * Environment switches for the company-database pipeline. Read on every call
 * (not at import) so scripts can change them between runs.
 */

/** `fixture` serves recorded responses and makes zero network calls. */
export function getProviderMode(): "live" | "fixture" {
  return process.env.GTM_PROVIDER_MODE === "fixture" ? "fixture" : "live"
}

/** `legacy` keeps the Firecrawl Stage 4; `database` uses the company provider. */
export function getDiscoveryMode(): "database" | "legacy" {
  return process.env.GTM_DISCOVERY_MODE === "database" ? "database" : "legacy"
}

/** Which company-discovery vendor to use. Only "apollo" exists today. */
export function getCompanyProviderKey(): string {
  return process.env.GTM_COMPANY_PROVIDER || "apollo"
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
 * Which decision-maker vendor to use. Only the synthetic "fixture" provider
 * exists today: the Apollo Free plan blocks people search (HTTP 403).
 */
export function getPeopleProviderKey(): string {
  return process.env.GTM_PEOPLE_PROVIDER || "fixture"
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

/** Which email-enrichment vendor finds and verifies addresses. Only "fullenrich" exists. */
export function getEmailProviderKey(): string {
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

/** Companies the verified-lead search may examine per campaign: default 40, ceiling 60. */
export function getMaxCompaniesExamined(): number {
  return intEnv("GTM_MAX_COMPANIES_EXAMINED", 40, 1, 60)
}

/**
 * Email lookups (each can cost at most one vendor credit) per campaign, across
 * restarts: default 20, ceiling 45. Counted from stored lookups, so a restart
 * never gets a fresh budget.
 */
export function getEmailLookupsPerCampaign(): number {
  return intEnv("GTM_EMAIL_LOOKUPS_PER_CAMPAIGN", 20, 0, 45)
}

/** Wall-clock limit of one verified-lead search attempt, in ms. Default 15 min, max 30. */
export function getLeadSearchMaxMs(): number {
  return intEnv("GTM_LEAD_SEARCH_MAX_MINUTES", 15, 1, 30) * 60_000
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

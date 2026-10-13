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

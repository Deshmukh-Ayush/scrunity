import { apolloCompanyProvider } from "./apollo"
import {
  getCompanyProviderKey,
  getDiscoveryMode,
  getEmailProviderKey,
  getPeopleProviderKey,
  getProviderMode,
} from "./config"
import { fixturePeopleProvider } from "./fixture-people"
import { fullEnrichEmailProvider } from "./fullenrich"
import { webPeopleProvider } from "./people-web"
import {
  EmailProviderUnavailableError,
  PeopleProviderUnavailableError,
  type CompanyDiscoveryProvider,
  type EmailEnrichmentProvider,
  type PeopleDiscoveryProvider,
} from "./types"

const COMPANY_PROVIDERS: Record<string, { provider: CompanyDiscoveryProvider; keyEnv: string }> = {
  apollo: { provider: apolloCompanyProvider, keyEnv: "APOLLO_API_KEY" },
}

/** The company-discovery vendor selected by GTM_COMPANY_PROVIDER (default apollo). */
export function getCompanyDiscoveryProvider(): CompanyDiscoveryProvider {
  const key = getCompanyProviderKey()
  const entry = COMPANY_PROVIDERS[key]
  if (!entry) {
    throw new Error(`Unknown GTM_COMPANY_PROVIDER "${key}"`)
  }
  return entry.provider
}

/** Env var holding the company provider's API key (checked before any spend). */
export function companyProviderKeyEnv(): string | null {
  return COMPANY_PROVIDERS[getCompanyProviderKey()]?.keyEnv ?? null
}

const PEOPLE_PROVIDERS: Record<string, { provider: PeopleDiscoveryProvider; keyEnv: string | null }> = {
  fixture: { provider: fixturePeopleProvider, keyEnv: null },
  // Firecrawl LinkedIn and team-page searches, within the existing caps and limiter.
  web: { provider: webPeopleProvider, keyEnv: "FIRECRAWL_API_KEY" },
}

/**
 * The decision-maker provider selected by GTM_PEOPLE_PROVIDER (default:
 * "fixture" in fixture mode, "web" otherwise). The synthetic fixture provider
 * is refused outside fixture mode: synthetic people must never reach a real
 * campaign. A provider whose API key is missing is refused too.
 */
export function getPeopleDiscoveryProvider(): PeopleDiscoveryProvider {
  const key = getPeopleProviderKey()
  const entry = PEOPLE_PROVIDERS[key]
  const fixture = getProviderMode() === "fixture"
  if (
    !entry ||
    (entry.provider === fixturePeopleProvider && !fixture) ||
    (!fixture && entry.keyEnv && !process.env[entry.keyEnv])
  ) {
    throw new PeopleProviderUnavailableError(key)
  }
  return entry.provider
}

/**
 * Decision makers for the verified-lead search (Stage 5). Database mode uses
 * GTM_PEOPLE_PROVIDER; legacy (web) discovery mode uses the web provider,
 * except in fixture mode, where the configured (fixture) provider is used.
 */
export function getLeadSearchPeopleProvider(): PeopleDiscoveryProvider {
  if (getDiscoveryMode() === "database" || getProviderMode() === "fixture") {
    return getPeopleDiscoveryProvider()
  }
  return webPeopleProvider
}

const EMAIL_PROVIDERS: Record<string, { provider: EmailEnrichmentProvider; keyEnv: string }> = {
  fullenrich: { provider: fullEnrichEmailProvider, keyEnv: "FULLENRICH_API_KEY" },
}

/**
 * The email-enrichment vendor (GTM_EMAIL_PROVIDER, default fullenrich). Throws
 * EmailProviderUnavailableError when its API key is missing outside fixture
 * mode: the stage then stops with a plain message and never guesses an address.
 */
export function getEmailEnrichmentProvider(): EmailEnrichmentProvider {
  const key = getEmailProviderKey()
  const entry = EMAIL_PROVIDERS[key]
  if (!entry) throw new EmailProviderUnavailableError(`unknown GTM_EMAIL_PROVIDER "${key}"`)
  if (getProviderMode() !== "fixture" && !process.env[entry.keyEnv]) {
    throw new EmailProviderUnavailableError(`${entry.keyEnv} is not set`)
  }
  return entry.provider
}

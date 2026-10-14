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

const COMPANY_PROVIDERS: Record<string, CompanyDiscoveryProvider> = {
  apollo: apolloCompanyProvider,
}

/** The company-discovery vendor selected by GTM_COMPANY_PROVIDER (default apollo). */
export function getCompanyDiscoveryProvider(): CompanyDiscoveryProvider {
  const key = getCompanyProviderKey()
  const provider = COMPANY_PROVIDERS[key]
  if (!provider) {
    throw new Error(`Unknown GTM_COMPANY_PROVIDER "${key}"`)
  }
  return provider
}

const PEOPLE_PROVIDERS: Record<string, PeopleDiscoveryProvider> = {
  fixture: fixturePeopleProvider,
}

/**
 * The decision-maker vendor selected by GTM_PEOPLE_PROVIDER. Only the synthetic
 * fixture provider exists, so it is refused in live mode: synthetic people must
 * never reach a real campaign.
 */
export function getPeopleDiscoveryProvider(): PeopleDiscoveryProvider {
  const key = getPeopleProviderKey()
  const provider = PEOPLE_PROVIDERS[key]
  if (
    !provider ||
    (provider === fixturePeopleProvider && getProviderMode() !== "fixture")
  ) {
    throw new PeopleProviderUnavailableError(key)
  }
  return provider
}

/**
 * Decision makers for the verified-lead search (Stage 5). Database mode uses
 * GTM_PEOPLE_PROVIDER (fixture only today); legacy (web) discovery mode uses the
 * interim web provider, except in fixture mode, where no Firecrawl call may run.
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

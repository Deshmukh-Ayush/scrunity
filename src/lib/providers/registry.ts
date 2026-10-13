import { apolloCompanyProvider } from "./apollo"
import {
  getCompanyProviderKey,
  getPeopleProviderKey,
  getProviderMode,
} from "./config"
import { fixturePeopleProvider } from "./fixture-people"
import {
  PeopleProviderUnavailableError,
  type CompanyDiscoveryProvider,
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

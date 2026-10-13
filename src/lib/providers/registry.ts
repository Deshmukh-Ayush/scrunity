import { apolloCompanyProvider } from "./apollo"
import { getCompanyProviderKey } from "./config"
import type { CompanyDiscoveryProvider } from "./types"

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

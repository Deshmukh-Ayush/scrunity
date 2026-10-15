import { getDiscoveryMode, getProviderMode } from "@/lib/providers/config"
import {
  companyProviderKeyEnv,
  getCompanyDiscoveryProvider,
  getEmailEnrichmentProvider,
  getLeadSearchPeopleProvider,
} from "@/lib/providers/registry"

/** Thrown at the start of Stage 4 when a provider the campaign needs is missing. */
export class CampaignProvidersUnavailableError extends Error {
  constructor(public readonly failureReason: string, message: string) {
    super(message)
    this.name = "CampaignProvidersUnavailableError"
  }
}

export type ProviderCheck =
  | { ok: true }
  | { ok: false; failureReason: string; message: string }

const unavailable = (failureReason: string, what: string): ProviderCheck => ({
  ok: false,
  failureReason,
  message: `Lead search isn't available right now: ${what} is not set up. Please contact support.`,
})

/**
 * Checks, without any network call, that every provider a campaign needs in the
 * current discovery mode is configured: company search (database mode),
 * decision-maker search and email lookup. Run it before a campaign starts and
 * before Stage 4 spends anything, so a missing provider costs nothing.
 * Messages never name a vendor.
 */
export function checkCampaignProviders(): ProviderCheck {
  const fixture = getProviderMode() === "fixture"
  if (getDiscoveryMode() === "database") {
    try {
      getCompanyDiscoveryProvider()
    } catch {
      return unavailable("company_provider_unavailable", "company search")
    }
    const keyEnv = companyProviderKeyEnv()
    if (!fixture && keyEnv && !process.env[keyEnv]) {
      return unavailable("company_provider_unavailable", "company search")
    }
  } else if (!fixture && !process.env.FIRECRAWL_API_KEY) {
    return unavailable("people_provider_unavailable", "web search")
  }
  try {
    getLeadSearchPeopleProvider()
  } catch {
    return unavailable("people_provider_unavailable", "decision-maker search")
  }
  try {
    getEmailEnrichmentProvider()
  } catch {
    return unavailable("email_provider_unavailable", "email lookup")
  }
  return { ok: true }
}

/** Throws CampaignProvidersUnavailableError when checkCampaignProviders fails. */
export function assertCampaignProviders() {
  const check = checkCampaignProviders()
  if (!check.ok) throw new CampaignProvidersUnavailableError(check.failureReason, check.message)
}

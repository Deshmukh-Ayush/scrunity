import { getDiscoveryMode, getProviderMode } from "@/lib/providers/config"
import { hasFirecrawlApiKey } from "@/lib/vendors/firecrawl/client"
import { resolvePeopleProvider } from "@/lib/data-sources/resolve"
import { hasConnectionEncryptionKey } from "@/lib/data-sources/secret-box"
import { DATA_SOURCE_COPY } from "@/lib/data-sources/copy"
import type { DataSourceResolution } from "@/lib/data-sources/types"
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
  | { ok: true; resolution: DataSourceResolution }
  | {
      ok: false
      failureReason: string
      message: string
      /** The fix the UI offers: connect (or reconnect) the data source. */
      action?: "connect_data_source"
    }

const unavailable = (failureReason: string, what: string): ProviderCheck => ({
  ok: false,
  failureReason,
  message: `Lead search isn't available right now: ${what} is not set up. Please contact support.`,
})

/** Platform-paid data (allowlisted internal organizations): every env-selected provider must be configured. */
function checkPlatformProviders(resolution: DataSourceResolution): ProviderCheck {
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
  } else if (!fixture && !hasFirecrawlApiKey()) {
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
  return { ok: true, resolution }
}

/**
 * Checks, without any vendor call, that this organization can run a campaign:
 * its own connected data source, or (allowlisted internal organizations only)
 * platform data with every provider configured. Run it before a campaign starts
 * and before Stage 4 spends anything, so a missing provider costs nothing.
 */
export async function checkCampaignProviders(organizationId: string): Promise<ProviderCheck> {
  const resolution = await resolvePeopleProvider(organizationId)
  if (resolution.kind === "not_connected") {
    return {
      ok: false,
      failureReason: "data_source_not_connected",
      message: resolution.reason === "needs_reconnect" ? DATA_SOURCE_COPY.startBlockedReconnect : DATA_SOURCE_COPY.startBlocked,
      action: "connect_data_source",
    }
  }
  if (resolution.kind === "customer") {
    // Fail closed: without the dedicated key the stored secret cannot be read.
    if (!hasConnectionEncryptionKey()) {
      return { ok: false, failureReason: "data_source_encryption_unavailable", message: DATA_SOURCE_COPY.unavailable }
    }
    return { ok: true, resolution }
  }
  return checkPlatformProviders(resolution)
}

/** Throws CampaignProvidersUnavailableError when checkCampaignProviders fails; returns the resolution otherwise. */
export async function assertCampaignProviders(organizationId: string): Promise<DataSourceResolution> {
  const check = await checkCampaignProviders(organizationId)
  if (!check.ok) throw new CampaignProvidersUnavailableError(check.failureReason, check.message)
  return check.resolution
}

import type { DataSourceResolution, ProviderConnectionRecord } from "./types"

/**
 * The provider decision, pure so every branch is tested without a database
 * (lib/data-sources/resolve.ts feeds it the stored connection and env).
 *
 * Order: a campaign started from an imported list uses that list, whatever
 * else is connected. Then an active customer connection. Otherwise only an
 * allowlisted internal organization gets platform-paid data, and only while
 * PEOPLE_DATA_PROVIDER allows it. Everyone else is not connected.
 */

/** PEOPLE_DATA_PROVIDER: firecrawl (default) or legacy for allowlisted orgs; "none" turns platform data off. */
export function platformDataMode(env: NodeJS.ProcessEnv = process.env): "firecrawl" | "legacy" | "none" {
  const value = env.PEOPLE_DATA_PROVIDER?.trim().toLowerCase()
  if (value === "legacy" || value === "none") return value
  return "firecrawl"
}

/** PLATFORM_DATA_ORG_IDS, comma-separated organization ids. Empty by default. */
export function parsePlatformOrgIds(env: NodeJS.ProcessEnv = process.env): Set<string> {
  return new Set(
    (env.PLATFORM_DATA_ORG_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  )
}

export function decidePeopleProvider({
  organizationId,
  importId = null,
  connection,
  platformOrgIds,
  platformMode,
}: {
  organizationId: string
  /** The campaign's imported list (gtm_outreach_campaign.source_import_id), if any. */
  importId?: string | null
  connection: Pick<ProviderConnectionRecord, "id" | "provider" | "status" | "encryptedSecret"> | null
  platformOrgIds: ReadonlySet<string>
  platformMode: "firecrawl" | "legacy" | "none"
}): DataSourceResolution {
  if (importId) return { kind: "csv_import", importId }
  if (connection?.status === "active" && connection.encryptedSecret) {
    return { kind: "customer", provider: connection.provider, connectionId: connection.id }
  }
  if (platformOrgIds.has(organizationId) && platformMode !== "none") {
    return { kind: "platform", mode: platformMode }
  }
  return {
    kind: "not_connected",
    reason: connection?.status === "invalid" ? "needs_reconnect" : "none",
  }
}

/**
 * Shapes for customer data-provider connections (bring your own key). Pure and
 * client-safe: nothing here carries a secret.
 */

export const DATA_PROVIDERS = ["apollo"] as const
export type DataProvider = (typeof DATA_PROVIDERS)[number]

export type ConnectionStatus = "active" | "invalid" | "revoked"
export type ConnectionAuthType = "api_key" | "oauth"

/** The stored row as the server reads it (the secret column stays server-side). */
export interface ProviderConnectionRecord {
  id: string
  organizationId: string
  provider: DataProvider
  authType: ConnectionAuthType
  encryptedSecret: string | null
  secretLast4: string | null
  status: ConnectionStatus
  connectedByUserId: string | null
  createdAt: Date
  lastVerifiedAt: Date | null
  lastErrorCode: string | null
}

/** What customers see about a connection. Never the secret or the ciphertext. */
export interface PublicConnection {
  provider: DataProvider
  status: ConnectionStatus
  authType: ConnectionAuthType
  last4: string | null
  connectedAt: string
  lastVerifiedAt: string | null
  /** Neutral code (data_source_*), never vendor text. */
  lastErrorCode: string | null
}

/**
 * Where a campaign's people and email data come from.
 * - customer: the organization's own connected account; the connection id
 *   travels, the key is decrypted inside the step that calls the provider.
 * - platform: Scrunity-paid data, only for allowlisted internal organizations
 *   (PLATFORM_DATA_ORG_IDS); `mode` is PEOPLE_DATA_PROVIDER.
 * - not_connected: nothing usable; starting a campaign is refused.
 */
export type DataSourceResolution =
  | { kind: "customer"; provider: DataProvider; connectionId: string }
  | { kind: "platform"; mode: "firecrawl" | "legacy" }
  | { kind: "not_connected"; reason: "none" | "needs_reconnect" }

/** The worst-case credit cost of one campaign on the customer's own account. */
export interface RunCreditEstimate {
  provider: DataProvider
  /** Most credits one campaign can spend, all attempts together (= the run cap when lower). */
  maxCreditsPerCampaign: number
  /** The per-run cap that stops a campaign before it spends more. */
  runCap: number
}

/** GET /api/gtm/data-sources. */
export interface DataSourcesStatus {
  access: "customer" | "platform" | "not_connected"
  connection: PublicConnection | null
  estimate: RunCreditEstimate
  /** The caller may connect or disconnect (owner or admin). */
  canManage: boolean
}

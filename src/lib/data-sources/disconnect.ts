import { revokeConnection } from "./connections"
import type { DataProvider } from "./types"

/**
 * Disconnecting a data source runs these steps in order, after the secret is
 * removed. Each gets the connection id; the records a connection produced
 * carry it as source_connection_id (indexed on gtm_prospect_company and
 * gtm_contact), so removing them is one more step appended here.
 */
export type DisconnectStep = (connection: { organizationId: string; connectionId: string }) => Promise<void>

export const AFTER_REVOKE_STEPS: DisconnectStep[] = []

/** Removes the secret and marks the connection revoked, then runs AFTER_REVOKE_STEPS. Null when nothing was connected. */
export async function disconnectDataSource(
  organizationId: string,
  provider: DataProvider
): Promise<{ connectionId: string } | null> {
  const revoked = await revokeConnection(organizationId, provider)
  if (!revoked) return null
  for (const step of AFTER_REVOKE_STEPS) await step({ organizationId, connectionId: revoked.connectionId })
  return revoked
}

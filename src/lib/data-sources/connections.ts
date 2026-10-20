import { and, eq } from "drizzle-orm"
import { db } from "@/utils/db"
import { gtmProviderConnection } from "@/db/schema"
import { decryptConnectionSecret, encryptConnectionSecret, secretLast4 } from "./secret-box"
import type { DataProvider, ProviderConnectionRecord } from "./types"

/**
 * Stored customer connections. Every read is scoped to the organization; the
 * decrypted secret is returned only by `readConnectionSecret`, which callers
 * use inside the step that makes the vendor call and never pass on.
 */

export async function getConnection(organizationId: string, provider: DataProvider): Promise<ProviderConnectionRecord | null> {
  const [row] = await db
    .select()
    .from(gtmProviderConnection)
    .where(and(eq(gtmProviderConnection.organizationId, organizationId), eq(gtmProviderConnection.provider, provider)))
    .limit(1)
  return row ?? null
}

/**
 * Stores a key that was just validated: one row per organization and provider,
 * replaced on reconnect (same id, so records it produced stay traceable).
 */
export async function saveValidatedConnection({
  organizationId,
  provider,
  secret,
  userId,
}: {
  organizationId: string
  provider: DataProvider
  secret: string
  userId: string
}): Promise<ProviderConnectionRecord> {
  const now = new Date()
  const values = {
    authType: "api_key" as const,
    encryptedSecret: encryptConnectionSecret(secret),
    secretLast4: secretLast4(secret),
    status: "active" as const,
    connectedByUserId: userId,
    lastVerifiedAt: now,
    lastErrorCode: null,
  }
  const [row] = await db
    .insert(gtmProviderConnection)
    .values({ organizationId, provider, createdAt: now, ...values })
    .onConflictDoUpdate({
      target: [gtmProviderConnection.organizationId, gtmProviderConnection.provider],
      set: { ...values, createdAt: now },
    })
    .returning()
  return row
}

/**
 * Disconnect: the secret is removed at once and the row marked revoked. The
 * records this connection produced are untouched here; removing them is the
 * caller's next step (they carry source_connection_id = the returned id).
 */
export async function revokeConnection(organizationId: string, provider: DataProvider): Promise<{ connectionId: string } | null> {
  const [row] = await db
    .update(gtmProviderConnection)
    .set({ status: "revoked", encryptedSecret: null, lastErrorCode: null })
    .where(and(eq(gtmProviderConnection.organizationId, organizationId), eq(gtmProviderConnection.provider, provider)))
    .returning({ id: gtmProviderConnection.id })
  return row ? { connectionId: row.id } : null
}

/** The vendor rejected the key: campaigns stop and the customer is asked to reconnect. */
export async function markConnectionInvalid(connectionId: string, errorCode: string) {
  await db
    .update(gtmProviderConnection)
    .set({ status: "invalid", lastErrorCode: errorCode })
    .where(and(eq(gtmProviderConnection.id, connectionId), eq(gtmProviderConnection.status, "active")))
}

/** Records a non-fatal failure (plan block, credits used up) for the status view. */
export async function recordConnectionError(connectionId: string, errorCode: string | null) {
  await db
    .update(gtmProviderConnection)
    .set({ lastErrorCode: errorCode })
    .where(eq(gtmProviderConnection.id, connectionId))
}

export class ConnectionUnavailableError extends Error {
  public readonly failureReason = "data_source_not_connected"
  constructor() {
    super("The organization's data source connection is not active.")
    this.name = "ConnectionUnavailableError"
  }
}

/**
 * The decrypted secret of an active connection that belongs to this
 * organization. Throws ConnectionUnavailableError otherwise (revoked or
 * invalid in the meantime, or another organization's id).
 */
export async function readConnectionSecret(organizationId: string, connectionId: string): Promise<string> {
  const [row] = await db
    .select({ encryptedSecret: gtmProviderConnection.encryptedSecret, status: gtmProviderConnection.status })
    .from(gtmProviderConnection)
    .where(and(eq(gtmProviderConnection.id, connectionId), eq(gtmProviderConnection.organizationId, organizationId)))
    .limit(1)
  if (!row || row.status !== "active" || !row.encryptedSecret) throw new ConnectionUnavailableError()
  return decryptConnectionSecret(row.encryptedSecret)
}

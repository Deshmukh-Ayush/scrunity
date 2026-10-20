import { ApolloError } from "@/lib/vendors/apollo/errors"
import { publicDataSourceCode } from "./codes"
import { toPublicConnection } from "./public"
import type { ProviderConnectionRecord, PublicConnection } from "./types"

/**
 * Connecting a pasted API key: shape check, one validating vendor call, then
 * encrypted storage, in that order, so an invalid key is never stored. Pure
 * apart from the injected steps, so tests prove the key never appears in a
 * result or a thrown error.
 */

/** Longest key accepted; Apollo keys are far shorter. Bounds what is encrypted and sent. */
const MAX_KEY_LENGTH = 200

export type ConnectResult =
  | { ok: true; connection: PublicConnection }
  | { ok: false; code: string; httpStatus: number }

/** Trimmed key, or null when it cannot be a key (empty, too long, inner whitespace). */
export function normalizePastedKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const key = raw.trim()
  if (!key || key.length > MAX_KEY_LENGTH || /\s/.test(key)) return null
  return key
}

/** HTTP status for a failed connect, by public code. */
function statusFor(code: string): number {
  if (code === "data_source_rate_limited") return 429
  if (code === "data_source_unavailable") return 503
  if (code === "data_source_request_failed") return 502
  return 422
}

export async function connectWithKey({
  rawKey,
  encryptionAvailable,
  validate,
  save,
}: {
  rawKey: unknown
  encryptionAvailable: boolean
  validate: (key: string) => Promise<void>
  save: (key: string) => Promise<ProviderConnectionRecord>
}): Promise<ConnectResult> {
  const key = normalizePastedKey(rawKey)
  if (!key) return { ok: false, code: "data_source_key_missing", httpStatus: 400 }
  // Fail closed before any vendor call: a key we could not store is never checked.
  if (!encryptionAvailable) return { ok: false, code: "data_source_unavailable", httpStatus: 503 }
  try {
    await validate(key)
  } catch (err) {
    const code = err instanceof ApolloError ? publicDataSourceCode(err.failureReason) : "data_source_request_failed"
    return { ok: false, code, httpStatus: statusFor(code) }
  }
  try {
    return { ok: true, connection: toPublicConnection(await save(key)) }
  } catch {
    // Never rethrow: a storage error could carry the encrypted value or the key.
    return { ok: false, code: "data_source_unavailable", httpStatus: 503 }
  }
}

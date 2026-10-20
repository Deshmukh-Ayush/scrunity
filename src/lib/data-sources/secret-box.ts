import { decryptWithSecret, encryptWithSecret } from "@/lib/encryption"

/**
 * Encryption for customer data-provider secrets (API keys, later OAuth tokens).
 * Uses only the dedicated ENCRYPTION_KEY: unlike mailbox tokens there is no
 * fallback to the auth secret, so rotating the auth secret can never expose or
 * break these. Without the key every call fails closed.
 *
 * Error messages never contain the secret or the ciphertext.
 */

/** Minimum length for ENCRYPTION_KEY; shorter values are treated as unset. */
const MIN_KEY_LENGTH = 32

export class ConnectionSecretKeyMissingError extends Error {
  public readonly failureReason = "data_source_encryption_unavailable"
  constructor() {
    super(
      "ENCRYPTION_KEY is not set (or shorter than 32 characters). Provider connection secrets cannot be stored or read."
    )
    this.name = "ConnectionSecretKeyMissingError"
  }
}

export class ConnectionSecretUnreadableError extends Error {
  public readonly failureReason = "data_source_secret_unreadable"
  constructor() {
    super("A stored provider connection secret could not be decrypted (wrong ENCRYPTION_KEY or corrupted value).")
    this.name = "ConnectionSecretUnreadableError"
  }
}

function connectionEncryptionKey(env: NodeJS.ProcessEnv = process.env): string {
  const key = env.ENCRYPTION_KEY?.trim()
  if (!key || key.length < MIN_KEY_LENGTH) throw new ConnectionSecretKeyMissingError()
  return key
}

/** True when connection secrets can be stored and read (no value is exposed). */
export function hasConnectionEncryptionKey(env: NodeJS.ProcessEnv = process.env): boolean {
  try {
    connectionEncryptionKey(env)
    return true
  } catch {
    return false
  }
}

export function encryptConnectionSecret(secret: string, env: NodeJS.ProcessEnv = process.env): string {
  return encryptWithSecret(secret, connectionEncryptionKey(env))
}

export function decryptConnectionSecret(encrypted: string, env: NodeJS.ProcessEnv = process.env): string {
  const key = connectionEncryptionKey(env)
  try {
    return decryptWithSecret(encrypted, key)
  } catch {
    // The underlying error can carry fragments of the payload: replace it.
    throw new ConnectionSecretUnreadableError()
  }
}

/** The last four characters shown to customers, so they can tell keys apart. */
export function secretLast4(secret: string): string {
  return secret.trim().slice(-4)
}

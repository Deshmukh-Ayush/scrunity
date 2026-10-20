import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;

/** Derives a fixed 256-bit (32-byte) key from a secret using SHA-256. */
function deriveKey(secret: string): Buffer {
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Mailbox tokens: ENCRYPTION_KEY, falling back to the auth secret. Provider
 * connection secrets do not use this fallback (lib/data-sources/secret-box.ts).
 */
function getMailboxEncryptionSecret(): string {
  const secret =
    process.env.ENCRYPTION_KEY ||
    process.env.BETTER_AUTH_SECRET ||
    process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error(
      "Encryption key not configured. Please set ENCRYPTION_KEY or BETTER_AUTH_SECRET in your environment."
    );
  }
  return secret;
}

/**
 * AES-256-GCM authenticated encryption with the given secret.
 * Returns a serialized string in the format: `${iv}:${authTag}:${ciphertext}` (all in hex).
 */
export function encryptWithSecret(plaintext: string, secret: string): string {
  if (!plaintext) {
    throw new Error("Cannot encrypt empty or null string");
  }

  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, deriveKey(secret), iv);

  let ciphertext = cipher.update(plaintext, "utf8", "hex");
  ciphertext += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString("hex");
  const ivHex = iv.toString("hex");

  return `${ivHex}:${authTag}:${ciphertext}`;
}

/**
 * Decrypts `${iv}:${authTag}:${ciphertext}` with the given secret.
 * Throws if the payload was tampered with, corrupted or encrypted with another secret.
 */
export function decryptWithSecret(encryptedString: string, secret: string): string {
  if (!encryptedString) {
    throw new Error("Cannot decrypt empty string");
  }

  const parts = encryptedString.split(":");
  if (parts.length !== 3) {
    throw new Error(
      "Invalid encrypted token format. Expected 'iv:authTag:ciphertext'"
    );
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, deriveKey(secret), iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertextHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/** Encrypts a mailbox token (see getMailboxEncryptionSecret for the key). */
export function encryptToken(plaintext: string): string {
  return encryptWithSecret(plaintext, getMailboxEncryptionSecret());
}

/** Decrypts a mailbox token encrypted with encryptToken. */
export function decryptToken(encryptedString: string): string {
  return decryptWithSecret(encryptedString, getMailboxEncryptionSecret());
}

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;

function getEncryptionKey(): Buffer {
  const secret =
    process.env.ENCRYPTION_KEY ||
    process.env.BETTER_AUTH_SECRET ||
    process.env.AUTH_SECRET;

  if (!secret) {
    throw new Error(
      "Encryption key not configured. Please set ENCRYPTION_KEY or BETTER_AUTH_SECRET in your environment."
    );
  }

  // Derive a fixed 256-bit (32-byte) key using SHA-256
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypts a sensitive string using AES-256-GCM authenticated encryption.
 * Returns a serialized string in the format: `${iv}:${authTag}:${ciphertext}` (all in hex).
 */
export function encryptToken(plaintext: string): string {
  if (!plaintext) {
    throw new Error("Cannot encrypt empty or null string");
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let ciphertext = cipher.update(plaintext, "utf8", "hex");
  ciphertext += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString("hex");
  const ivHex = iv.toString("hex");

  return `${ivHex}:${authTag}:${ciphertext}`;
}

/**
 * Decrypts an AES-256-GCM encrypted string.
 * Expects the serialized format: `${iv}:${authTag}:${ciphertext}` (all in hex).
 * Throws an error if the payload was tampered with or corrupted.
 */
export function decryptToken(encryptedString: string): string {
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
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertextHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

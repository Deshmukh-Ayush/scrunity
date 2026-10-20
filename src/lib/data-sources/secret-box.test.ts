import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  ConnectionSecretKeyMissingError,
  ConnectionSecretUnreadableError,
  decryptConnectionSecret,
  encryptConnectionSecret,
  hasConnectionEncryptionKey,
  secretLast4,
} from "./secret-box"

const FAKE_SECRET = "test_key_example"
const env = (vars: Record<string, string | undefined>) => vars as NodeJS.ProcessEnv
const withKey = env({ ENCRYPTION_KEY: "x".repeat(32) })

describe("provider connection secrets", () => {
  it("round-trips through AES-256-GCM, and the ciphertext does not contain the secret", () => {
    const encrypted = encryptConnectionSecret(FAKE_SECRET, withKey)
    assert.ok(!encrypted.includes(FAKE_SECRET))
    assert.equal(encrypted.split(":").length, 3)
    assert.equal(decryptConnectionSecret(encrypted, withKey), FAKE_SECRET)
  })

  it("encrypts the same secret differently each time (random IV)", () => {
    assert.notEqual(encryptConnectionSecret(FAKE_SECRET, withKey), encryptConnectionSecret(FAKE_SECRET, withKey))
  })

  it("fails closed without ENCRYPTION_KEY, even when BETTER_AUTH_SECRET is set", () => {
    const authOnly = env({ BETTER_AUTH_SECRET: "y".repeat(40) })
    assert.equal(hasConnectionEncryptionKey(authOnly), false)
    assert.throws(() => encryptConnectionSecret(FAKE_SECRET, authOnly), ConnectionSecretKeyMissingError)
    assert.throws(() => decryptConnectionSecret("aa:bb:cc", authOnly), ConnectionSecretKeyMissingError)
  })

  it("treats a short ENCRYPTION_KEY as unset", () => {
    assert.equal(hasConnectionEncryptionKey(env({ ENCRYPTION_KEY: "short" })), false)
  })

  it("never puts the secret or ciphertext in an error when the key is wrong", () => {
    const encrypted = encryptConnectionSecret(FAKE_SECRET, withKey)
    const otherKey = env({ ENCRYPTION_KEY: "z".repeat(32) })
    assert.throws(
      () => decryptConnectionSecret(encrypted, otherKey),
      (err: unknown) =>
        err instanceof ConnectionSecretUnreadableError &&
        !err.message.includes(FAKE_SECRET) &&
        !err.message.includes(encrypted.split(":")[2])
    )
  })

  it("shows only the last four characters", () => {
    assert.equal(secretLast4(`  ${FAKE_SECRET} `), "mple")
  })
})

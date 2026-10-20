import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { ApolloError } from "@/lib/vendors/apollo/errors"
import { connectWithKey, normalizePastedKey } from "./connect"
import { estimateApolloRunCredits, toPublicConnection } from "./public"
import type { ProviderConnectionRecord } from "./types"

const FAKE_KEY = "test_key_example"

const storedRow = (overrides: Partial<ProviderConnectionRecord> = {}): ProviderConnectionRecord => ({
  id: "conn_1",
  organizationId: "org_1",
  provider: "apollo",
  authType: "api_key",
  encryptedSecret: "aabbcc:ddeeff:0011223344",
  secretLast4: "mple",
  status: "active",
  connectedByUserId: "user_1",
  createdAt: new Date("2026-10-21T10:00:00Z"),
  lastVerifiedAt: new Date("2026-10-21T10:00:00Z"),
  lastErrorCode: null,
  ...overrides,
})

describe("status response", () => {
  it("never contains the secret or the ciphertext", () => {
    const json = JSON.stringify(toPublicConnection(storedRow()))
    assert.ok(!json.includes(FAKE_KEY))
    assert.ok(!json.includes("aabbcc"))
    assert.ok(!json.includes("encrypted"))
    assert.deepEqual(Object.keys(JSON.parse(json)).sort(), [
      "authType",
      "connectedAt",
      "last4",
      "lastErrorCode",
      "lastVerifiedAt",
      "provider",
      "status",
    ])
  })

  it("drops the last four once disconnected", () => {
    assert.equal(toPublicConnection(storedRow({ status: "revoked", encryptedSecret: null })).last4, null)
  })
})

describe("connecting a pasted key", () => {
  const save = async () => storedRow()

  it("rejects an empty key, inner whitespace and an absurd length before any call", async () => {
    assert.equal(normalizePastedKey("   "), null)
    assert.equal(normalizePastedKey("abc def"), null)
    assert.equal(normalizePastedKey("x".repeat(201)), null)
    assert.equal(normalizePastedKey(42), null)
    let called = false
    const result = await connectWithKey({ rawKey: "", encryptionAvailable: true, validate: async () => { called = true }, save })
    assert.deepEqual(result, { ok: false, code: "data_source_key_missing", httpStatus: 400 })
    assert.equal(called, false)
  })

  it("fails closed without encryption, before the vendor sees the key", async () => {
    let called = false
    const result = await connectWithKey({ rawKey: FAKE_KEY, encryptionAvailable: false, validate: async () => { called = true }, save })
    assert.equal(result.ok, false)
    assert.equal(called, false)
  })

  it("stores only a validated key and returns the public view", async () => {
    let saved: string | null = null
    const result = await connectWithKey({
      rawKey: `  ${FAKE_KEY}  `,
      encryptionAvailable: true,
      validate: async () => {},
      save: async (key) => {
        saved = key
        return storedRow()
      },
    })
    assert.equal(saved, FAKE_KEY)
    assert.ok(result.ok && result.connection.last4 === "mple")
    assert.ok(!JSON.stringify(result).includes(FAKE_KEY))
  })

  it("maps a rejected key to a neutral code, never stores it, never echoes it", async () => {
    let saved = false
    const result = await connectWithKey({
      rawKey: FAKE_KEY,
      encryptionAvailable: true,
      validate: async () => {
        throw new ApolloError("apollo_key_invalid", 401)
      },
      save: async () => {
        saved = true
        return storedRow()
      },
    })
    assert.deepEqual(result, { ok: false, code: "data_source_key_invalid", httpStatus: 422 })
    assert.equal(saved, false)
  })

  it("maps a plan block and a rate limit to their own codes", async () => {
    const run = (failure: ConstructorParameters<typeof ApolloError>[0], status: number) =>
      connectWithKey({ rawKey: FAKE_KEY, encryptionAvailable: true, validate: async () => { throw new ApolloError(failure, status) }, save })
    assert.deepEqual(await run("apollo_plan_blocked", 403), { ok: false, code: "data_source_plan_blocked", httpStatus: 422 })
    assert.deepEqual(await run("apollo_rate_limited", 429), { ok: false, code: "data_source_rate_limited", httpStatus: 429 })
  })

  it("swallows a storage error that could carry the key", async () => {
    const result = await connectWithKey({
      rawKey: FAKE_KEY,
      encryptionAvailable: true,
      validate: async () => {},
      save: async () => {
        throw new Error(`insert failed for ${FAKE_KEY}`)
      },
    })
    assert.deepEqual(result, { ok: false, code: "data_source_unavailable", httpStatus: 503 })
  })
})

describe("run estimate", () => {
  it("is one company search page plus one credit per lookup, capped by the run cap", () => {
    assert.deepEqual(estimateApolloRunCredits({ emailLookupsPerCampaign: 20, runCap: 25 }), {
      provider: "apollo",
      maxCreditsPerCampaign: 21,
      runCap: 25,
    })
    assert.equal(estimateApolloRunCredits({ emailLookupsPerCampaign: 45, runCap: 25 }).maxCreditsPerCampaign, 25)
  })
})

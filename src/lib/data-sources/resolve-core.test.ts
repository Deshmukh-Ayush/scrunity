import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { decidePeopleProvider, parsePlatformOrgIds, platformDataMode } from "./resolve-core"

const env = (vars: Record<string, string | undefined>) => vars as NodeJS.ProcessEnv
const active = { id: "conn_1", provider: "apollo" as const, status: "active" as const, encryptedSecret: "a:b:c" }
const internal = new Set(["org_internal"])

describe("resolvePeopleProvider decision", () => {
  it("uses the organization's active connection", () => {
    assert.deepEqual(
      decidePeopleProvider({ organizationId: "org_customer", connection: active, platformOrgIds: new Set(), platformMode: "firecrawl" }),
      { kind: "customer", provider: "apollo", connectionId: "conn_1" }
    )
  })

  it("prefers the connection even for an allowlisted internal organization", () => {
    const resolution = decidePeopleProvider({ organizationId: "org_internal", connection: active, platformOrgIds: internal, platformMode: "firecrawl" })
    assert.equal(resolution.kind, "customer")
  })

  it("gives platform data only to allowlisted organizations, in the env-selected mode", () => {
    assert.deepEqual(
      decidePeopleProvider({ organizationId: "org_internal", connection: null, platformOrgIds: internal, platformMode: "legacy" }),
      { kind: "platform", mode: "legacy" }
    )
    assert.deepEqual(
      decidePeopleProvider({ organizationId: "org_customer", connection: null, platformOrgIds: internal, platformMode: "firecrawl" }),
      { kind: "not_connected", reason: "none" }
    )
  })

  it("refuses platform data when PEOPLE_DATA_PROVIDER=none, even when allowlisted", () => {
    assert.equal(
      decidePeopleProvider({ organizationId: "org_internal", connection: null, platformOrgIds: internal, platformMode: "none" }).kind,
      "not_connected"
    )
  })

  it("asks for a reconnect after the key was rejected, and treats a revoked or empty connection as none", () => {
    const invalid = { ...active, status: "invalid" as const }
    assert.deepEqual(
      decidePeopleProvider({ organizationId: "org_customer", connection: invalid, platformOrgIds: new Set(), platformMode: "firecrawl" }),
      { kind: "not_connected", reason: "needs_reconnect" }
    )
    const revoked = { ...active, status: "revoked" as const, encryptedSecret: null }
    assert.deepEqual(
      decidePeopleProvider({ organizationId: "org_customer", connection: revoked, platformOrgIds: new Set(), platformMode: "firecrawl" }),
      { kind: "not_connected", reason: "none" }
    )
    const noSecret = { ...active, encryptedSecret: null }
    assert.equal(
      decidePeopleProvider({ organizationId: "org_customer", connection: noSecret, platformOrgIds: new Set(), platformMode: "firecrawl" }).kind,
      "not_connected"
    )
  })

  it("reads the allowlist and the mode from env", () => {
    assert.deepEqual([...parsePlatformOrgIds(env({ PLATFORM_DATA_ORG_IDS: " org_a, ,org_b " }))], ["org_a", "org_b"])
    assert.equal(parsePlatformOrgIds(env({})).size, 0)
    assert.equal(platformDataMode(env({})), "firecrawl")
    assert.equal(platformDataMode(env({ PEOPLE_DATA_PROVIDER: "LEGACY" })), "legacy")
    assert.equal(platformDataMode(env({ PEOPLE_DATA_PROVIDER: "none" })), "none")
  })
})

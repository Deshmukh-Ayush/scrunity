import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { describeLoadError, loadWithTimeout } from "./load-status"

const missingTable = () => {
  const cause = Object.assign(new Error('relation "gtm_provider_connection" does not exist'), { name: "NeonDbError", code: "42P01" })
  return Object.assign(new Error("Failed query: select ... params: org_secret"), { cause })
}

describe("loadWithTimeout", () => {
  it("returns the value when the load succeeds", async () => {
    assert.deepEqual(await loadWithTimeout(async () => 42, 1000), { ok: true, value: 42 })
  })

  it("turns a thrown error into a failure instead of rethrowing", async () => {
    const result = await loadWithTimeout(async () => {
      throw missingTable()
    }, 1000)
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.reason, "failed")
  })

  it("gives up on a load that never settles", async () => {
    const result = await loadWithTimeout(() => new Promise<never>(() => {}), 20)
    assert.deepEqual(result, { ok: false, reason: "timeout", detail: "no answer after 20 ms" })
  })
})

describe("describeLoadError", () => {
  it("names a missing table from the wrapped driver error without the query or params", () => {
    const text = describeLoadError(missingTable())
    assert.match(text, /42P01/)
    assert.match(text, /db:migrate/)
    assert.doesNotMatch(text, /select|org_secret|gtm_provider_connection/)
  })

  it("falls back to the error name", () => {
    assert.equal(describeLoadError(new TypeError("boom")), "TypeError")
    assert.equal(describeLoadError("not an error"), "unknown error")
  })
})

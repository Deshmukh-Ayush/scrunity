import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { parseAlexandriaResponse, runAlexandria, type AlexandriaCall, type FirecrawlClientDeps } from "./client"
import { FirecrawlDataError } from "./errors"
import { fixtureFetch } from "./fixtures"

const call: AlexandriaCall = { provider: "fullenrich", capability: "people/search", options: { limit: 6, offset: 0 } }
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } })

/** Offline deps: no limiter, no real sleeps, a fixed key, a scripted fetch. */
function deps(responses: Response[], sleeps: number[] = []): FirecrawlClientDeps & { requests: RequestInit[] } {
  const requests: RequestInit[] = []
  return {
    requests,
    apiKey: "test-key",
    schedule: (request) => request(),
    sleep: async (ms) => {
      sleeps.push(ms)
    },
    onRateLimited: () => {},
    fetch: async (_url, init) => {
      requests.push(init)
      const next = responses.shift()
      if (!next) throw new Error("unexpected extra request")
      return next
    },
  }
}

describe("parseAlexandriaResponse", () => {
  const item = { success: true, provider: "fullenrich", capability: "people/search", creditsCost: 10, data: { people: [] } }

  it("reads the single-call OpenAPI shape", () => {
    const [result] = parseAlexandriaResponse(item, 1)
    assert.deepEqual(result, { ok: true, capability: "people/search", creditsCost: 10, data: { people: [] } })
  })

  it("reads the raw HTTP envelope with an alexandria array inside data", () => {
    const results = parseAlexandriaResponse({ success: true, data: { alexandria: [item, item] } }, 2)
    assert.equal(results.length, 2)
    assert.ok(results.every((r) => r.ok))
  })

  it("turns a terms-required call into a data_terms_required failure with the action URL kept", () => {
    const terms = { success: false, code: "THIRD_PARTY_DATA_TERMS_REQUIRED", requiresAction: { url: "https://firecrawl.example/terms" } }
    const [result] = parseAlexandriaResponse({ success: true, data: { alexandria: [terms] } }, 1)
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.error.failureReason, "data_terms_required")
      assert.equal(result.error.requiresActionUrl, "https://firecrawl.example/terms")
    }
  })

  it("throws a possibly-charged error for a malformed body or a call-count mismatch", () => {
    for (const body of [null, "nope", { success: true, data: { alexandria: [item] } }]) {
      assert.throws(
        () => parseAlexandriaResponse(body, 2),
        (err: unknown) => err instanceof FirecrawlDataError && err.charged === "unknown"
      )
    }
  })

  it("flags a result without creditsCost instead of trusting it", () => {
    const [result] = parseAlexandriaResponse({ alexandria: [{ success: true, data: {} }] }, 1)
    assert.equal(result.ok, false)
  })
})

describe("runAlexandria", () => {
  it("sends one call as an object and several as an array", async () => {
    const d = deps([json({ ...{ success: true, creditsCost: 0, data: {} } }), json({ alexandria: [{ creditsCost: 0 }, { creditsCost: 0 }] })])
    await runAlexandria([call], d)
    await runAlexandria([call, call], d)
    const bodies = d.requests.map((r) => JSON.parse(String(r.body)))
    assert.equal(Array.isArray(bodies[0].alexandria), false)
    assert.equal(bodies[1].alexandria.length, 2)
  })

  it("refuses more than 10 calls and an empty list without any request", async () => {
    const d = deps([])
    await assert.rejects(runAlexandria(Array(11).fill(call), d))
    await assert.rejects(runAlexandria([], d))
    assert.equal(d.requests.length, 0)
  })

  it("retries 429 with backoff, honouring Retry-After, then succeeds", async () => {
    const sleeps: number[] = []
    const d = deps(
      [json({}, 429, { "retry-after": "2" }), json({}, 429), json({ creditsCost: 5, data: { people: [] } })],
      sleeps
    )
    const [result] = await runAlexandria([call], d)
    assert.equal(result.ok, true)
    assert.deepEqual(sleeps, [2000, 10_000])
  })

  it("maps a 429 that outlasts the retries to provider_rate_limited", async () => {
    const d = { ...deps([json({}, 429), json({}, 429)]), maxRetries: 1 }
    await assert.rejects(runAlexandria([call], d), (err: unknown) => err instanceof FirecrawlDataError && err.failureReason === "provider_rate_limited")
  })

  it("stops retrying when another wait would overrun the time budget", async () => {
    // A fake clock: each request takes 90 s, each sleep advances it too.
    let clock = 0
    const sleeps: number[] = []
    const base = deps([json({}, 429), json({}, 429), json({}, 429)], sleeps)
    const d: FirecrawlClientDeps = {
      ...base,
      timeoutMs: 100_000,
      totalBudgetMs: 200_000,
      now: () => clock,
      sleep: async (ms) => {
        sleeps.push(ms)
        clock += ms
      },
      fetch: async (url, init) => {
        clock += 90_000
        return base.fetch!(url, init)
      },
    }
    await assert.rejects(runAlexandria([call], d), (err: unknown) => err instanceof FirecrawlDataError && err.failureReason === "provider_rate_limited")
    assert.deepEqual(sleeps, [5_000])
  })

  it("treats a timeout as possibly billed", async () => {
    const d = {
      ...deps([]),
      fetch: async () => {
        throw new DOMException("The operation timed out.", "TimeoutError")
      },
    }
    await assert.rejects(runAlexandria([call], d), (err: unknown) => err instanceof FirecrawlDataError && err.charged === "unknown")
  })

  it("maps HTTP errors to neutral failure codes", async () => {
    const cases: Array<[Response, string]> = [
      [json({ success: false, error: "Payment required" }, 402), "data_credits_exhausted"],
      [json({ success: false, code: "THIRD_PARTY_DATA_TERMS_REQUIRED", requiresAction: { url: "u" } }, 403), "data_terms_required"],
      [json({ success: false, error: "Unauthorized" }, 401), "provider_access_denied"],
      [json({ success: false, error: "Bad options" }, 400), "provider_request_failed"],
    ]
    for (const [response, reason] of cases) {
      await assert.rejects(runAlexandria([call], deps([response])), (err: unknown) => err instanceof FirecrawlDataError && err.failureReason === reason)
    }
  })

  it("never calls out without an API key", async () => {
    const d = { ...deps([]), apiKey: null }
    await assert.rejects(runAlexandria([call], d), (err: unknown) => err instanceof FirecrawlDataError && err.failureReason === "provider_access_denied")
    assert.equal(d.requests.length, 0)
  })

  it("serves fixtures through the same parser", async () => {
    const d = { ...deps([]), fetch: fixtureFetch }
    const options = { limit: 6, offset: 0, person_locations: [{ value: "Madhya Pradesh, India" }] }
    const [result] = await runAlexandria([{ ...call, options }], d)
    assert.equal(result.ok && result.creditsCost, 30)
  })
})

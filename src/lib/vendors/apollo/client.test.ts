import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { apolloRequest, type ApolloClientDeps } from "./client"
import { apolloFailureFor, ApolloError, invalidatesConnection } from "./errors"
import { createLimiterRegistry, type ConnectionLimiter } from "./limiter"

const FAKE_KEY = "test_key_example"
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } })

/** A limiter that runs at once and records pauses. */
function instantLimiter(): ConnectionLimiter & { pauses: number[] } {
  const pauses: number[] = []
  return { pauses, run: (request) => request(), pause: (ms) => pauses.push(ms) }
}

function deps(responses: Response[], extra: Partial<ApolloClientDeps> = {}) {
  const requests: Array<{ url: string; init: RequestInit }> = []
  const sleeps: number[] = []
  const limiter = instantLimiter()
  const d: ApolloClientDeps = {
    apiKey: FAKE_KEY,
    limiter,
    fetch: async (url, init) => {
      requests.push({ url, init })
      const next = responses.shift()
      if (!next) throw new Error("no scripted response")
      return next
    },
    sleep: async (ms) => {
      sleeps.push(ms)
    },
    ...extra,
  }
  return { d, requests, sleeps, limiter }
}

describe("Apollo error mapping", () => {
  it("maps statuses and Apollo's wording to neutral failures", () => {
    assert.equal(apolloFailureFor(401, "Invalid access credentials."), "apollo_key_invalid")
    assert.equal(apolloFailureFor(403, "api/v1/mixed_people/api_search is not accessible with this api_key on a free plan. Please upgrade"), "apollo_plan_blocked")
    assert.equal(apolloFailureFor(403, "Forbidden"), "apollo_key_invalid")
    assert.equal(apolloFailureFor(402, ""), "apollo_credits_exhausted")
    assert.equal(apolloFailureFor(422, "Insufficient credits"), "apollo_credits_exhausted")
    assert.equal(apolloFailureFor(429, ""), "apollo_rate_limited")
    assert.equal(apolloFailureFor(500, "boom"), "apollo_request_failed")
  })

  it("only a rejected key invalidates the connection", () => {
    assert.equal(invalidatesConnection("apollo_key_invalid"), true)
    for (const f of ["apollo_plan_blocked", "apollo_credits_exhausted", "apollo_rate_limited", "apollo_request_failed"] as const) {
      assert.equal(invalidatesConnection(f), false)
    }
  })
})

describe("Apollo client", () => {
  it("sends the key only in the x-api-key header", async () => {
    const { d, requests } = deps([json({ people: [] })])
    await apolloRequest({ path: "/api/v1/mixed_people/api_search", query: new URLSearchParams({ page: "1" }) }, d)
    assert.equal(new Headers(requests[0].init.headers).get("x-api-key"), FAKE_KEY)
    assert.ok(!requests[0].url.includes(FAKE_KEY))
    assert.equal(requests[0].init.body, undefined)
  })

  it("retries a 429 after Retry-After and pauses only this connection's limiter", async () => {
    const { d, sleeps, limiter } = deps([json({}, 429, { "retry-after": "2" }), json({ ok: true })])
    assert.deepEqual(await apolloRequest({ path: "/x" }, d), { ok: true })
    assert.deepEqual(sleeps, [2000])
    assert.deepEqual(limiter.pauses, [2000])
  })

  it("gives up on a 429 with apollo_rate_limited after its retries", async () => {
    const { d } = deps([json({}, 429), json({}, 429), json({}, 429)], { maxRetries: 2 })
    await assert.rejects(apolloRequest({ path: "/x" }, d), (err: unknown) => err instanceof ApolloError && err.failureReason === "apollo_rate_limited")
  })

  it("never puts the key or Apollo's response text in an error", async () => {
    const echo = `bad key ${FAKE_KEY}`
    const { d } = deps([json({ error: echo }, 401)])
    await assert.rejects(apolloRequest({ path: "/x" }, d), (err: unknown) => {
      assert.ok(err instanceof ApolloError)
      assert.equal(err.failureReason, "apollo_key_invalid")
      assert.ok(!err.message.includes(FAKE_KEY))
      assert.ok(!JSON.stringify(err).includes(FAKE_KEY))
      return true
    })
  })

  it("marks a dropped request as possibly charged", async () => {
    const { d } = deps([], {
      fetch: async () => {
        throw new Error(`socket hang up ${FAKE_KEY}`)
      },
    })
    await assert.rejects(apolloRequest({ path: "/x" }, d), (err: unknown) => {
      assert.ok(err instanceof ApolloError && err.charged === "unknown")
      assert.ok(!err.message.includes(FAKE_KEY))
      return true
    })
  })
})

describe("per-connection limiter", () => {
  it("gives each connection its own limiter, so one customer's pause never delays another", async () => {
    const registry = createLimiterRegistry(() => ({ requestsPerMinute: 600, maxConcurrency: 1 }))
    const a = registry.get("conn_a")
    assert.equal(registry.get("conn_a"), a)
    const b = registry.get("conn_b")
    assert.notEqual(a, b)
    a.pause(60_000)
    const started = Date.now()
    assert.equal(await b.run(async () => "ran"), "ran")
    assert.ok(Date.now() - started < 1_000)
    assert.equal(registry.size(), 2)
  })
})

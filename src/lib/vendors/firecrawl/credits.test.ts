import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { VendorCreditCapError } from "@/lib/providers/types"
import { exceededCap, memoryCreditLedger, withReservedCredits } from "./credits"
import { FirecrawlDataError } from "./errors"

describe("exceededCap", () => {
  it("allows a call that lands exactly on a cap", () => {
    assert.equal(exceededCap({ monthUsed: 970, runUsed: 0, credits: 30, monthlyCap: 1000, runCap: 30 }), null)
  })
  it("names the monthly cap first, then the run cap", () => {
    assert.equal(exceededCap({ monthUsed: 990, runUsed: 0, credits: 30, monthlyCap: 1000, runCap: 10 }), "monthly")
    assert.equal(exceededCap({ monthUsed: 0, runUsed: 100, credits: 30, monthlyCap: 1000, runCap: 120 }), "run")
  })
  it("ignores the run cap when there is none", () => {
    assert.equal(exceededCap({ monthUsed: 0, runUsed: 10_000, credits: 30, monthlyCap: 1000, runCap: null }), null)
  })
})

describe("withReservedCredits", () => {
  it("does not make a call that would exceed the per-run cap", async () => {
    const ledger = memoryCreditLedger({ monthlyCap: 10_000, runCap: 100 }, { month: 0, run: 80 })
    let called = false
    await assert.rejects(
      withReservedCredits(ledger, 30, "people/search", async () => {
        called = true
        return { value: null, creditsCost: 30 }
      }),
      (err: unknown) => err instanceof VendorCreditCapError && err.scope === "run" && err.failureReason === "provider_run_credit_cap_reached"
    )
    assert.equal(called, false)
  })

  it("does not make a call that would exceed the monthly cap", async () => {
    const ledger = memoryCreditLedger({ monthlyCap: 100, runCap: null }, { month: 90, run: 0 })
    let called = false
    await assert.rejects(
      withReservedCredits(ledger, 20, "contacts/work-email", async () => {
        called = true
        return { value: null, creditsCost: 20 }
      }),
      (err: unknown) => err instanceof VendorCreditCapError && err.failureReason === "provider_credit_cap_reached"
    )
    assert.equal(called, false)
  })

  it("settles with the creditsCost Firecrawl returned, not the estimate", async () => {
    const ledger = memoryCreditLedger({ monthlyCap: 1000, runCap: 1000 })
    const value = await withReservedCredits(ledger, 30, "people/search", async () => ({ value: "ok", creditsCost: 10 }))
    assert.equal(value, "ok")
    assert.deepEqual(ledger.used, { month: 10, run: 10 })
    assert.deepEqual(ledger.settled, [{ endpoint: "people/search", credits: 10 }])
  })

  it("releases the reservation when the call failed before reaching Firecrawl", async () => {
    const ledger = memoryCreditLedger({ monthlyCap: 1000, runCap: 1000 })
    await assert.rejects(
      withReservedCredits(ledger, 30, "people/search", async () => {
        throw new FirecrawlDataError("provider_rate_limited", "429")
      })
    )
    assert.deepEqual(ledger.used, { month: 0, run: 0 })
  })

  it("keeps the reservation when the call may have been billed", async () => {
    const ledger = memoryCreditLedger({ monthlyCap: 1000, runCap: 1000 })
    await assert.rejects(
      withReservedCredits(ledger, 30, "people/search", async () => {
        throw new FirecrawlDataError("provider_request_failed", "unreadable", null, "unknown")
      })
    )
    assert.deepEqual(ledger.used, { month: 30, run: 30 })
  })
})

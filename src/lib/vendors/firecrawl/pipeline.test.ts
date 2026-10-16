import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { generatePeopleSearchFilters, toPeopleSearchFilters } from "@/lib/gtm-people-search"
import type { LlmProvider } from "@/lib/llm/provider"
import { VendorCreditCapError } from "@/lib/providers/types"
import type { FirecrawlClientDeps } from "./client"
import { memoryCreditLedger } from "./credits"
import { searchCompaniesByPeople } from "./discovery"
import { lookupWorkEmailBatch } from "./email-batch"
import { fixtureFetch } from "./fixtures"
import { personKeys } from "./people-search"
import { splitIntoBatches } from "./work-email"

/**
 * The Firecrawl half of the pipeline end to end on fixtures, with no network
 * and no database: segment -> filters -> people search -> companies with their
 * people -> work-email batches -> verified only.
 */

const requests: string[] = []
const deps: FirecrawlClientDeps = {
  apiKey: "fixture",
  schedule: (request) => request(),
  sleep: async () => {},
  fetch: async (url, init) => {
    requests.push(String(init.body))
    return fixtureFetch(url, init)
  },
}
const llm: LlmProvider = {
  key: "fake",
  async generateStructured<T>() {
    return { label: "founders of tiffin services", titles: ["Founder", "Owner"], seniority: [], industries: [] } as T
  },
  async generateText() {
    return ""
  },
}
const segment = { name: "Tiffin services", painPoint: "Lost orders", criteria: [], headcountMin: 10, headcountMax: 40 }

async function discover(market: { country: string; region: string | null }, ledger = memoryCreditLedger({ monthlyCap: 3000, runCap: 1200 })) {
  const filters = await generatePeopleSearchFilters({ segment, market, llm })
  const result = await searchCompaniesByPeople(
    { country: market.country, state: market.region, keywords: [], limit: 15, people: toPeopleSearchFilters(filters), candidateCap: 150 },
    { ledger, deps }
  )
  return { result, ledger }
}

describe("Firecrawl pipeline on fixtures", () => {
  it("finds Madhya Pradesh companies with their people, billing only what was returned", async () => {
    requests.length = 0
    const { result, ledger } = await discover({ country: "India", region: "Madhya Pradesh" })
    assert.deepEqual(
      result.companies.map((c) => [c.domain, c.people?.length]),
      [
        ["indoretiffin.example", 2],
        ["bhopaldabba.example", 1],
        ["gwaliormeals.example", 1],
        ["jabalpurkitchens.example", 1],
        ["ujjainhomefood.example", 1],
      ]
    )
    assert.deepEqual(result.skipped, { noCompanyDomain: 1, duplicates: 1, alreadyKnown: 0 })
    assert.equal(result.creditsUsed, 40)
    assert.deepEqual(ledger.used, { month: 40, run: 40 })
    // One request read everything (5 pages; empty pages past the end are free).
    assert.equal(requests.length, 1)
    assert.match(requests[0], /"person_locations":\[\{"value":"Madhya Pradesh, India"\}\]/)
  })

  it("returns no companies, at no cost, when nobody matches the region", async () => {
    const { result, ledger } = await discover({ country: "India", region: "Sikkim" })
    assert.equal(result.companies.length, 0)
    assert.equal(result.totalAvailable, 0)
    assert.deepEqual(ledger.used, { month: 0, run: 0 })
  })

  it("drops people the organization already has", async () => {
    const ledger = memoryCreditLedger({ monthlyCap: 3000, runCap: 1200 })
    const filters = await generatePeopleSearchFilters({ segment, market: { country: "India", region: "Madhya Pradesh" }, llm })
    const known = new Set(personKeys({ firstName: "Kabir", lastName: "Samplesingh", linkedinUrl: null, domain: "bhopaldabba.example" }))
    const result = await searchCompaniesByPeople(
      { country: "India", keywords: [], limit: 15, people: toPeopleSearchFilters(filters), excludePersonKeys: known },
      { ledger, deps }
    )
    assert.ok(!result.companies.some((c) => c.domain === "bhopaldabba.example"))
    assert.equal(result.skipped?.alreadyKnown, 1)
  })

  it("makes no request when the run cap cannot cover the first page group", async () => {
    requests.length = 0
    await assert.rejects(
      discover({ country: "India", region: "Madhya Pradesh" }, memoryCreditLedger({ monthlyCap: 3000, runCap: 100 })),
      (err: unknown) => err instanceof VendorCreditCapError && err.scope === "run"
    )
    assert.equal(requests.length, 0)
  })

  it("keeps only deliverable work emails, in batches of at most 10", async () => {
    const { result } = await discover({ country: "India", region: "Madhya Pradesh" })
    const inputs = result.companies.flatMap((c) =>
      (c.people ?? []).map((p) => ({ firstName: p.firstName, lastName: p.lastName, domain: c.domain!, companyName: c.name, linkedinUrl: p.linkedinUrl }))
    )
    const ledger = memoryCreditLedger({ monthlyCap: 3000, runCap: 1200 })
    requests.length = 0
    const outcomes = []
    for (const batch of splitIntoBatches(inputs)) outcomes.push(...(await lookupWorkEmailBatch(batch, { ledger, deps })))
    assert.equal(requests.length, 1)
    const verified = outcomes.filter((o) => o.result?.status === "verified").map((o) => o.result?.email)
    assert.deepEqual(verified, ["aarav@indoretiffin.example", "meera@gwaliormeals.example"])
    const statuses = outcomes.map((o) => o.result?.status)
    assert.deepEqual(statuses, ["verified", "unverified", "unverified", "verified", "not_found", "unverified"])
    // Five records found (20 each); the empty result is free.
    assert.deepEqual(ledger.used, { month: 100, run: 100 })
  })

  it("does not send a work-email batch the monthly cap cannot cover", async () => {
    requests.length = 0
    const ledger = memoryCreditLedger({ monthlyCap: 100, runCap: null }, { month: 90, run: 0 })
    const input = { firstName: "Aarav", lastName: "Fixturewala", domain: "indoretiffin.example" }
    await assert.rejects(lookupWorkEmailBatch([input], { ledger, deps }), VendorCreditCapError)
    assert.equal(requests.length, 0)
  })
})

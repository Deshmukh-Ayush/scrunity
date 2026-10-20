import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { memoryCreditLedger } from "@/lib/providers/credit-ledger"
import { VendorCreditCapError, type EmailLookupInput } from "@/lib/providers/types"
import { matchPeople, searchOrganizations, searchPeopleAtCompany, validateApolloKey } from "./calls"
import type { ApolloClientDeps } from "./client"
import { ApolloError } from "./errors"
import { apolloFixtureFetch } from "./fixtures"
import { parseBulkMatch } from "./people-match"
import { buildPeopleSearchParams, parsePeopleSearch } from "./people-search"

const FAKE_KEY = "test_key_example"
const deps = (fetch: ApolloClientDeps["fetch"]): ApolloClientDeps => ({
  apiKey: FAKE_KEY,
  limiter: { run: (request) => request(), pause: () => {} },
  fetch,
  sleep: async () => {},
})
const fixtureDeps = () => deps(apolloFixtureFetch)
const noCaps = { monthlyCap: null, runCap: null }

const input = (id: string, domain = "acme.example"): EmailLookupInput => ({
  firstName: "Asha",
  lastName: "Fi***r",
  domain,
  providerPersonId: id,
})

describe("verified-email rule", () => {
  const body = (match: Record<string, unknown> | null) => ({ matches: [match], credits_consumed: match ? 1 : 0 })
  const person = { id: "p1", first_name: "Asha", last_name: "Fixturekar", linkedin_url: "https://linkedin.com/in/asha" }

  it("accepts only Apollo's explicit verified status at the company's own domain", () => {
    const { outcomes } = parseBulkMatch(body({ ...person, email: "asha@acme.example", email_status: "verified" }), [input("p1")])
    assert.equal(outcomes[0].result?.status, "verified")
    assert.equal(outcomes[0].result?.email, "asha@acme.example")
    assert.equal(outcomes[0].result?.revealed?.lastName, "Fixturekar")
  })

  it("stores no address for any other status, or none at all", () => {
    for (const email_status of ["unverified", "guessed", "likely to engage", "extrapolated", null]) {
      const { outcomes } = parseBulkMatch(body({ ...person, email: "asha@acme.example", email_status }), [input("p1")])
      assert.equal(outcomes[0].result?.status, "unverified", String(email_status))
      assert.equal(outcomes[0].result?.email, null)
    }
  })

  it("keeps the stricter domain check: a verified address elsewhere is not accepted", () => {
    const { outcomes } = parseBulkMatch(body({ ...person, email: "asha@gmail.com", email_status: "verified" }), [input("p1")])
    assert.equal(outcomes[0].result?.status, "not_found")
    assert.equal(outcomes[0].result?.note, "email_at_other_company")
    assert.equal(outcomes[0].result?.email, null)
  })

  it("joins results by person id, not by position", () => {
    const { outcomes, creditsCost } = parseBulkMatch(
      { matches: [{ id: "p2", first_name: "Ravi", last_name: "T", email: "ravi@acme.example", email_status: "verified" }, null] },
      [input("p1"), input("p2")]
    )
    assert.equal(outcomes[0].result?.status, "not_found")
    assert.equal(outcomes[1].result?.status, "verified")
    assert.equal(creditsCost, 1)
  })

  it("treats a body without matches as possibly charged", () => {
    assert.throws(() => parseBulkMatch({}, [input("p1")]), (err: unknown) => err instanceof ApolloError && err.charged === "unknown")
  })
})

describe("people search", () => {
  it("searches one company by domain with the target titles", () => {
    const params = buildPeopleSearchParams({
      company: { name: "Acme", domain: "ACME.example", providerId: null },
      titles: ["Founder", "Head of Operations"],
      country: "India",
      limit: 6,
    })
    assert.equal(params.get("q_organization_domains_list[]"), "acme.example")
    assert.deepEqual(params.getAll("person_titles[]"), ["Founder", "Head of Operations"])
    assert.equal(params.get("per_page"), "6")
  })

  it("keeps the masked last name and drops people Apollo has no email for", () => {
    const people = parsePeopleSearch({
      people: [
        { id: "a", first_name: "Asha", last_name_obfuscated: "Fi***r", title: "Founder", has_email: true },
        { id: "b", first_name: "Ravi", last_name_obfuscated: "Te***a", has_email: false },
        { first_name: "No id" },
      ],
    })
    assert.equal(people.length, 1)
    assert.equal(people[0].lastName, "Fi***r")
    assert.equal(people[0].linkedinUrl, null)
  })
})

describe("credits and the per-run cap", () => {
  it("the people search costs nothing and writes no ledger row", async () => {
    const people = await searchPeopleAtCompany(
      { company: { name: "Acme", domain: "acme.example", providerId: null }, titles: ["Founder"], country: "India", limit: 6 },
      fixtureDeps()
    )
    assert.equal(people.length, 3)
  })

  it("reserves one credit per person before a match and settles with Apollo's count", async () => {
    const ledger = memoryCreditLedger(noCaps)
    const outcomes = await matchPeople(
      [input("fx-ap-acme.example-1"), input("fx-ap-acme.example-2"), input("fx-ap-acme.example-3")],
      { deps: fixtureDeps(), ledger }
    )
    assert.deepEqual(outcomes.map((o) => o.result?.status), ["verified", "unverified", "not_found"])
    assert.deepEqual(ledger.settled, [{ endpoint: "/api/v1/people/bulk_match", credits: 2 }])
    assert.equal(ledger.used.run, 2)
  })

  it("refuses a match that would pass the run cap, before any request", async () => {
    let requests = 0
    const ledger = memoryCreditLedger({ monthlyCap: null, runCap: 2 }, { month: 0, run: 1 }, "apollo_customer")
    await assert.rejects(
      matchPeople([input("p1"), input("p2")], {
        deps: deps(async () => {
          requests++
          return new Response("{}")
        }),
        ledger,
      }),
      (err: unknown) => err instanceof VendorCreditCapError && err.scope === "run"
    )
    assert.equal(requests, 0)
  })

  it("has no monthly cap of ours on a customer's account", async () => {
    const ledger = memoryCreditLedger(noCaps, { month: 1_000_000, run: 0 })
    const result = await searchOrganizations(
      { country: "India", state: "Delhi", keywords: ["saas"], limit: 5 },
      { deps: fixtureDeps(), ledger }
    )
    assert.ok(result.companies.length > 0)
    assert.equal(result.companies[0].source, "apollo")
    assert.equal(ledger.used.run, 1)
  })

  it("a rejected key settles the reservation at zero and is reported as invalid", async () => {
    const ledger = memoryCreditLedger(noCaps)
    const invalid = { ...fixtureDeps(), apiKey: "fixture_invalid_key" }
    await assert.rejects(
      matchPeople([input("fx-ap-acme.example-1")], { deps: invalid, ledger }),
      (err: unknown) => err instanceof ApolloError && err.failureReason === "apollo_key_invalid"
    )
    assert.equal(ledger.used.run, 0)
    await assert.rejects(validateApolloKey(invalid), (err: unknown) => err instanceof ApolloError)
  })
})

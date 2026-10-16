import assert from "node:assert/strict"
import { describe, it } from "node:test"
import fixture from "./fixtures/work-email-results.json"
import { FirecrawlDataError } from "./errors"
import { STATUS_NOT_PROVIDED, parseWorkEmailData, splitIntoBatches, workEmailCall } from "./work-email"

const input = (first: string, last: string, domain: string, linkedinUrl: string | null = null) => ({
  firstName: first,
  lastName: last,
  domain,
  companyName: "Some Co",
  linkedinUrl,
})
const results: Record<string, unknown> = fixture.results

describe("splitIntoBatches", () => {
  for (const [count, sizes] of [
    [1, [1]],
    [10, [10]],
    [11, [10, 1]],
    [25, [10, 10, 5]],
  ] as const) {
    it(`splits ${count} contacts into ${sizes.join(" + ")}`, () => {
      const batches = splitIntoBatches(Array.from({ length: count }, (_, i) => i))
      assert.deepEqual(batches.map((b) => b.length), sizes)
      assert.deepEqual(batches.flat(), Array.from({ length: count }, (_, i) => i))
    })
  }

  it("returns no batches for no contacts", () => {
    assert.deepEqual(splitIntoBatches([]), [])
  })
})

describe("workEmailCall", () => {
  it("uses the LinkedIn profile when there is one", () => {
    const call = workEmailCall(input("A", "B", "x.example", "https://www.linkedin.com/in/a-b"))
    assert.deepEqual(call.options, { linkedin_url: "https://www.linkedin.com/in/a-b" })
    assert.equal(call.capability, "contacts/work-email")
  })

  it("uses name and domain otherwise", () => {
    assert.deepEqual(workEmailCall(input("A", "B", "x.example")).options, { first_name: "A", last_name: "B", domain: "x.example" })
  })
})

describe("verified-only filter", () => {
  it("keeps a DELIVERABLE address at the company domain", () => {
    const r = parseWorkEmailData(results["aarav fixturewala@indoretiffin.example"], input("Aarav", "Fixturewala", "indoretiffin.example"), 20)
    assert.deepEqual(r, { vendor: "firecrawl", creditsUsed: 20, email: "aarav@indoretiffin.example", status: "verified", vendorStatus: "DELIVERABLE" })
  })

  for (const [key, status] of [
    ["diya testkar@indoretiffin.example", "CATCH_ALL"],
    ["kabir samplesingh@bhopaldabba.example", "HIGH_PROBABILITY"],
    ["tara exemplar@ujjainhomefood.example", STATUS_NOT_PROVIDED],
  ] as const) {
    it(`drops ${status} (no address is returned)`, () => {
      const [name, domain] = key.split("@")
      const [first, last] = name.split(" ")
      const r = parseWorkEmailData(results[key], input(first, last, domain), 20)
      assert.equal(r.status, "unverified")
      assert.equal(r.email, null)
      assert.equal(r.vendorStatus, status)
    })
  }

  it("treats an empty results array as not found", () => {
    const r = parseWorkEmailData({ results: [] }, input("I", "M", "jabalpurkitchens.example"), 0)
    assert.equal(r.status, "not_found")
    assert.equal(r.creditsUsed, 0)
  })

  it("never accepts a deliverable address at another company", () => {
    const data = { results: [{ contact_info: { most_probable_work_email: { email: "a@elsewhere.example", status: "DELIVERABLE" } } }] }
    const r = parseWorkEmailData(data, input("A", "B", "indoretiffin.example"), 20)
    assert.equal(r.email, null)
    assert.equal(r.note, "email_at_other_company")
  })

  it("prefers a deliverable candidate from work_emails over an unproven most-probable one", () => {
    const data = {
      results: [
        {
          contact_info: {
            most_probable_work_email: { email: "a.b@x.example", status: "CATCH_ALL" },
            work_emails: [{ email: "ab@x.example", status: "deliverable" }],
          },
        },
      ],
    }
    assert.equal(parseWorkEmailData(data, input("A", "B", "x.example"), 20).email, "ab@x.example")
  })

  it("treats a bare string email (no status) as unverified", () => {
    const data = { results: [{ contact_info: { most_probable_work_email: "a@x.example" } }] }
    assert.equal(parseWorkEmailData(data, input("A", "B", "x.example"), 20).status, "unverified")
  })

  it("throws on a malformed payload", () => {
    for (const data of [null, {}, { results: "x" }]) {
      assert.throws(() => parseWorkEmailData(data, input("A", "B", "x.example"), 0), FirecrawlDataError)
    }
  })
})

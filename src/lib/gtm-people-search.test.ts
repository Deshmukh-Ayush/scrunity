import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { LlmProvider } from "@/lib/llm/provider"
import { buildPeopleSearchOptions } from "@/lib/vendors/firecrawl/people-search"
import {
  SearchFiltersInvalidError,
  generatePeopleSearchFilters,
  locationValue,
  segmentToSearchFilters,
  toPeopleSearchFilters,
} from "./gtm-people-search"

const segment = {
  name: "Tiffin services with 10 to 40 riders",
  painPoint: "Orders arrive on WhatsApp and get lost",
  criteria: ["Home-cooked meal delivery", "Team 10-40"],
  headcountMin: 10,
  headcountMax: 40,
}
const madhyaPradesh = { country: "India", region: "Madhya Pradesh" }
const goodOutput = {
  label: "Founders of tiffin services",
  titles: ["Founder", "Owner", "founder", "  Head of Operations "],
  seniority: ["founder", "Owner", "Supreme Leader"],
  industries: ["food & beverages", "made-up industry"],
}

/** An LLM that answers from a script, one entry per call; an Error entry is thrown. */
function scriptedLlm(answers: unknown[]): LlmProvider & { calls: number } {
  const llm = {
    key: "fake",
    calls: 0,
    async generateStructured<T>(): Promise<T> {
      const answer = answers[llm.calls++]
      if (answer instanceof Error) throw answer
      return answer as T
    },
    async generateText() {
      return ""
    },
  }
  return llm
}

describe("segment -> people-search filters", () => {
  it("sends a Madhya Pradesh, India target to person_locations", () => {
    const filters = segmentToSearchFilters(goodOutput, segment, madhyaPradesh)
    const options = buildPeopleSearchOptions(toPeopleSearchFilters(filters), { limit: 6, offset: 0 })
    assert.deepEqual(options.person_locations, [{ value: "Madhya Pradesh, India" }])
    assert.equal(filters.market, "Madhya Pradesh, India")
  })

  it("uses the country alone when no region was chosen", () => {
    assert.equal(locationValue("India", null), "India")
    assert.equal(locationValue(" India ", "  "), "India")
  })

  it("takes size from the segment, cleans titles, keeps only allowed seniority and known industries", () => {
    const filters = segmentToSearchFilters(goodOutput, segment, madhyaPradesh)
    assert.deepEqual(filters.titles, ["Founder", "Owner", "Head of Operations"])
    assert.deepEqual(filters.seniority, ["Founder", "Owner"])
    assert.deepEqual(filters.industries, ["food & beverages"])
    assert.equal(filters.headcountMin, 10)
    assert.equal(filters.headcountMax, 40)
    assert.equal(filters.label, "founders of tiffin services")
  })

  it("returns filters from a valid answer with one model call", async () => {
    const llm = scriptedLlm([goodOutput])
    const filters = await generatePeopleSearchFilters({ segment, market: madhyaPradesh, llm })
    assert.equal(llm.calls, 1)
    assert.deepEqual(filters.locations, ["Madhya Pradesh, India"])
  })

  it("retries once after invalid output, then succeeds", async () => {
    const llm = scriptedLlm([{ label: "x", titles: [] }, goodOutput])
    const filters = await generatePeopleSearchFilters({ segment, market: madhyaPradesh, llm })
    assert.equal(llm.calls, 2)
    assert.equal(filters.titles?.[0], "Founder")
  })

  it("fails with the neutral code after two invalid answers, and never calls a third time", async () => {
    const llm = scriptedLlm([{ titles: "Founder" }, new Error("Failed to validate JSON"), goodOutput])
    await assert.rejects(
      generatePeopleSearchFilters({ segment, market: madhyaPradesh, llm }),
      (err: unknown) => err instanceof SearchFiltersInvalidError && err.failureReason === "search_filters_invalid"
    )
    assert.equal(llm.calls, 2)
  })
})

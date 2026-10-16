import assert from "node:assert/strict"
import { describe, it } from "node:test"
import fixture from "./fixtures/people-search-madhya-pradesh.json"
import { FirecrawlDataError } from "./errors"
import {
  buildPeopleSearchOptions,
  collectPeople,
  dedupePeople,
  groupByCompany,
  parsePeopleSearchData,
  personKeys,
  planPages,
  type FoundPerson,
  type PeopleSearchPage,
} from "./people-search"

const filters = {
  titles: ["Founder", "Owner"],
  seniority: ["Founder"],
  locations: ["Madhya Pradesh, India"],
  industries: ["food & beverages"],
  headcountMin: 10,
  headcountMax: 40,
}

describe("buildPeopleSearchOptions", () => {
  it("uses the documented { value } entries and the headcount range", () => {
    assert.deepEqual(buildPeopleSearchOptions(filters, { limit: 6, offset: 12 }), {
      limit: 6,
      offset: 12,
      person_locations: [{ value: "Madhya Pradesh, India" }],
      current_position_titles: [{ value: "Founder" }, { value: "Owner" }],
      current_position_seniority_level: [{ value: "Founder" }],
      current_company_industries: [{ value: "food & beverages" }],
      current_company_headcounts: [{ min: 10, max: 40 }],
    })
  })

  it("leaves out empty filters and open headcount bounds", () => {
    const options = buildPeopleSearchOptions(
      { ...filters, seniority: [], industries: [], headcountMin: null, headcountMax: 50 },
      { limit: 6, offset: 0 }
    )
    assert.equal("current_position_seniority_level" in options, false)
    assert.equal("current_company_industries" in options, false)
    assert.deepEqual(options.current_company_headcounts, [{ max: 50 }])
  })
})

describe("parsePeopleSearchData", () => {
  it("reads the fixture people with their current company and LinkedIn profile", () => {
    const page = parsePeopleSearchData({ people: fixture.people, metadata: { total: 8 } })
    assert.equal(page.returned, 8)
    assert.equal(page.total, 8)
    const aarav = page.people[0]
    assert.equal(aarav.firstName, "Aarav")
    assert.equal(aarav.title, "Founder")
    assert.equal(aarav.linkedinUrl, "https://linkedin.example/in/aarav-fixturewala")
    assert.deepEqual(aarav.company && { name: aarav.company.name, domain: aarav.company.domain, headcount: aarav.company.headcount }, {
      name: "Indore Tiffin Co",
      domain: "indoretiffin.example",
      headcount: 25,
    })
  })

  it("returns an empty page for an empty result", () => {
    assert.deepEqual(parsePeopleSearchData({ people: [], metadata: { total: 0 } }), { people: [], returned: 0, total: 0 })
  })

  it("skips unreadable people but counts them as returned (they were billed)", () => {
    const page = parsePeopleSearchData({ people: [{ id: 1 }, "junk", fixture.people[0]] })
    assert.equal(page.people.length, 1)
    assert.equal(page.returned, 3)
  })

  it("throws on a payload without a people array", () => {
    for (const data of [null, {}, { people: "x" }]) {
      assert.throws(() => parsePeopleSearchData(data), FirecrawlDataError)
    }
  })

  it("reads an employment list with a current flag and a website instead of a domain", () => {
    const page = parsePeopleSearchData({
      people: [
        {
          id: "x1",
          full_name: "Neha Sampleton",
          employment: [
            { is_current: false, title: "Analyst", company: { name: "Old Co", domain: "old.example" } },
            { is_current: true, title: "Founder", company: { name: "New Co", website: "https://www.newco.example/about" } },
          ],
        },
      ],
    })
    assert.equal(page.people[0].lastName, "Sampleton")
    assert.equal(page.people[0].title, "Founder")
    assert.equal(page.people[0].company?.domain, "newco.example")
  })
})

describe("pagination", () => {
  it("plans pages of 6 up to the cap", () => {
    assert.deepEqual(planPages(14), [
      { limit: 6, offset: 0 },
      { limit: 6, offset: 6 },
      { limit: 2, offset: 12 },
    ])
  })

  const fullPage = (limit: number): PeopleSearchPage => ({ people: [], returned: limit, total: 10_000 })

  it("stops at the candidate cap", async () => {
    const seen: number[] = []
    const result = await collectPeople({
      cap: 150,
      pagesPerRequest: 10,
      runGroup: async (pages) => {
        seen.push(...pages.map((p) => p.offset))
        return pages.map((p) => fullPage(p.limit))
      },
    })
    assert.equal(result.returned, 150)
    assert.equal(result.requests, 3)
    assert.equal(Math.max(...seen), 144)
  })

  it("stops after a short page without starting another request", async () => {
    let requests = 0
    const result = await collectPeople({
      cap: 150,
      pagesPerRequest: 2,
      runGroup: async (pages) => {
        requests++
        return pages.map((p, i) => ({ people: [], returned: requests === 2 && i === 1 ? 3 : p.limit, total: null }))
      },
    })
    assert.equal(requests, 2)
    assert.equal(result.returned, 21)
  })

  it("stops early once the caller has enough", async () => {
    let requests = 0
    await collectPeople({
      cap: 150,
      pagesPerRequest: 5,
      runGroup: async (pages) => {
        requests++
        return pages.map((p) => fullPage(p.limit))
      },
      enough: () => requests >= 2,
    })
    assert.equal(requests, 2)
  })

  it("stops when the reported total is read", async () => {
    let requests = 0
    await collectPeople({
      cap: 150,
      pagesPerRequest: 1,
      runGroup: async (pages) => {
        requests++
        return pages.map((p) => ({ people: [], returned: p.limit, total: 12 }))
      },
    })
    assert.equal(requests, 2)
  })
})

describe("dedupe and grouping", () => {
  const people = parsePeopleSearchData({ people: fixture.people }).people

  it("drops repeats within the run", () => {
    const { kept, duplicates } = dedupePeople(people)
    assert.equal(duplicates, 1)
    assert.equal(kept.length, 7)
  })

  it("drops people already in the organization, by LinkedIn or by name at the domain", () => {
    const existing = new Set([
      ...personKeys({ firstName: "Aarav", lastName: "Fixturewala", linkedinUrl: "http://LinkedIn.example/in/aarav-fixturewala/", domain: null }),
      ...personKeys({ firstName: "meera", lastName: "PLACEHOLDER", linkedinUrl: null, domain: "gwaliormeals.example" }),
    ])
    const { kept, alreadyKnown } = dedupePeople(people, existing)
    assert.equal(alreadyKnown, 2)
    assert.ok(!kept.some((p) => p.firstName === "Aarav" || p.firstName === "Meera"))
  })

  it("groups by company domain and counts people without one", () => {
    const { groups, withoutDomain } = groupByCompany(dedupePeople(people).kept)
    assert.equal(withoutDomain, 1)
    assert.deepEqual(
      groups.map((g) => [g.company.domain, g.people.length]),
      [
        ["indoretiffin.example", 2],
        ["bhopaldabba.example", 1],
        ["gwaliormeals.example", 1],
        ["jabalpurkitchens.example", 1],
        ["ujjainhomefood.example", 1],
      ]
    )
  })

  it("dedupes companies across differently written domains", () => {
    const base = people[0] as FoundPerson
    const twin: FoundPerson = { ...base, id: "other", firstName: "Other", company: { ...base.company!, domain: "indoretiffin.example" } }
    assert.equal(groupByCompany([base, twin]).groups.length, 1)
  })
})

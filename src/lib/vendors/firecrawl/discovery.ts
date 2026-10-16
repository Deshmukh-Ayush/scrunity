import {
  collectPeople,
  dedupePeople,
  groupByCompany,
  parsePeopleSearchData,
  peopleSearchCall,
  PEOPLE_SEARCH_CAPABILITY,
  PEOPLE_SEARCH_CREDITS_PER_RECORD,
  type CompanyGroup,
  type FoundPerson,
  type PeopleSearchPage,
} from "./people-search"
import { getPeopleSearchCandidateCap } from "@/lib/providers/config"
import type {
  CompanyDiscoveryQuery,
  CompanyDiscoveryResult,
  NormalizedCompany,
  NormalizedPerson,
  PeopleSearchFilters,
} from "@/lib/providers/types"
import { runAlexandria, type FirecrawlClientDeps } from "./client"
import { withReservedCredits, type CreditLedger } from "./credits"

const SOURCE = "firecrawl"
/**
 * Pages per request. Each request is reserved at its worst case (5 pages x 6
 * records x 5 credits = 150) before it is sent; 5 keeps that reservation small
 * and still reads the default 150 candidates in 5 requests (under a minute at
 * the shared 8 requests/minute limiter, inside one Stage 4 step).
 */
const PAGES_PER_REQUEST = 5
/**
 * No new request starts after this long (Stage 4 is one Inngest step, which
 * must stay well under 300 s); the companies found so far are kept.
 */
const SEARCH_TIME_BUDGET_MS = 90_000

export function toNormalizedPerson(person: FoundPerson): NormalizedPerson {
  return {
    providerPersonId: person.id,
    firstName: person.firstName,
    lastName: person.lastName,
    title: person.title,
    linkedinUrl: person.linkedinUrl,
    location: person.location,
    source: SOURCE,
  }
}

export function toNormalizedCompany({
  company,
  people,
}: CompanyGroup): NormalizedCompany {
  return {
    providerId: company.id ?? company.domain,
    name: company.name,
    domain: company.domain,
    website: `https://${company.domain}`,
    linkedinUrl: company.linkedinUrl,
    country: null,
    state: null,
    city: null,
    location: company.location,
    industry: company.industry,
    headcount: company.headcount,
    revenueRange: null,
    description: null,
    source: SOURCE,
    people: people.map(toNormalizedPerson),
  }
}

export interface DataCallContext {
  ledger: CreditLedger
  deps: FirecrawlClientDeps
}

/** One request: a group of pages, credits reserved before it and settled with creditsCost. */
async function searchPages(
  filters: PeopleSearchFilters,
  pages: Array<{ limit: number; offset: number }>,
  { ledger, deps }: DataCallContext
): Promise<{ pages: PeopleSearchPage[]; creditsCost: number }> {
  const estimate = pages.reduce(
    (sum, p) => sum + p.limit * PEOPLE_SEARCH_CREDITS_PER_RECORD,
    0
  )
  return withReservedCredits(
    ledger,
    estimate,
    PEOPLE_SEARCH_CAPABILITY,
    async () => {
      const results = await runAlexandria(
        pages.map((page) => peopleSearchCall(filters, page)),
        deps
      )
      let creditsCost = 0
      const parsed: PeopleSearchPage[] = []
      for (const result of results) {
        if (!result.ok) throw result.error
        creditsCost += result.creditsCost
        parsed.push(parsePeopleSearchData(result.data))
      }
      return { value: { pages: parsed, creditsCost }, creditsCost }
    }
  )
}

/**
 * Company discovery through people search (PEOPLE_DATA_PROVIDER=firecrawl): the
 * people matching the segment's titles, seniority, location, industries and
 * size band, grouped by their current company. Pages until the candidate cap,
 * the end of the results, or `limit` distinct companies. People repeated in the
 * run, already known to the organization, or without a readable company domain
 * are dropped (counted in `skipped`). Each company carries its people, so Stage
 * 5 never searches again.
 */
export async function searchCompaniesByPeople(
  query: CompanyDiscoveryQuery,
  call: DataCallContext
): Promise<CompanyDiscoveryResult> {
  const filters = query.people
  if (!filters)
    throw new Error("The people-search company provider needs people filters.")
  const existing = query.excludePersonKeys ?? new Set<string>()
  const settle = (people: FoundPerson[]) => {
    const deduped = dedupePeople(people, existing)
    return { ...deduped, ...groupByCompany(deduped.kept) }
  }
  let creditsUsed = 0
  const startedAt = Date.now()
  const collected = await collectPeople({
    cap: query.candidateCap ?? getPeopleSearchCandidateCap(),
    pagesPerRequest: PAGES_PER_REQUEST,
    runGroup: async (pages) => {
      const result = await searchPages(filters, pages, call)
      creditsUsed += result.creditsCost
      return result.pages
    },
    enough: (people) =>
      settle(people).groups.length >= query.limit || Date.now() - startedAt >= SEARCH_TIME_BUDGET_MS,
  })
  const { groups, withoutDomain, duplicates, alreadyKnown } = settle(
    collected.people
  )
  const companies = groups.slice(0, query.limit).map(toNormalizedCompany)
  // Every company behind the filters was read: the count is complete.
  const complete =
    collected.total !== null && collected.returned >= collected.total
  return {
    companies,
    totalAvailable: complete || companies.length === 0 ? groups.length : null,
    creditsUsed,
    skipped: { noCompanyDomain: withoutDomain, duplicates, alreadyKnown },
  }
}

import { z } from "zod"
import type { CompanySearchFilters } from "@/db/schema"
import { getLlmProvider, type LlmProvider } from "@/lib/llm/provider"
import { knownIndustries } from "@/lib/providers/industries"
import type { PeopleSearchFilters } from "@/lib/providers/types"

/**
 * Turns an ICP segment into people-search filters (job titles, seniority,
 * industries) with one LLM call. Location and headcount are not left to the
 * model: they come from the campaign's target market and the segment's size
 * band, so a region such as "Madhya Pradesh, India" always reaches
 * person_locations exactly as the user chose it.
 *
 * The model's JSON is validated with a schema; invalid output is retried once,
 * then the step fails with the neutral code "search_filters_invalid".
 */

export interface PeopleSearchSegment {
  name: string
  painPoint: string
  criteria: string[]
  headcountMin?: number | null
  headcountMax?: number | null
}

const MAX_TITLES = 6
const MAX_INDUSTRIES = 2

/**
 * Seniority values the search may use. The provider documents "Founder, VP, or
 * Manager" as examples but not its full list, so anything else is dropped
 * rather than risk a filter that silently matches nobody.
 */
export const SENIORITY_LEVELS = ["Owner", "Founder", "C-Level", "Partner", "VP", "Director", "Head", "Manager"] as const

export const peopleFiltersOutputSchema = z.object({
  label: z.string().min(1).describe("Who is searched for, plural and lowercase, at most 6 words, e.g. 'founders of tiffin services'"),
  titles: z
    .array(z.string().min(1))
    .min(1)
    .max(MAX_TITLES)
    .describe(`1 to ${MAX_TITLES} current job titles of the person who would buy, most likely first, e.g. 'Founder', 'Owner', 'Head of Operations'`),
  seniority: z.array(z.string()).max(3).describe(`0 to 3 seniority levels from this list only: ${SENIORITY_LEVELS.join(", ")}`),
  industries: z.array(z.string()).max(MAX_INDUSTRIES).describe(`0 to ${MAX_INDUSTRIES} industries of the target companies; empty when unsure`),
})

export type PeopleFiltersOutput = z.infer<typeof peopleFiltersOutputSchema>

export class SearchFiltersInvalidError extends Error {
  public readonly failureReason = "search_filters_invalid"
  constructor(detail: string) {
    super(`Could not build people-search filters for this segment: ${detail}`)
    this.name = "SearchFiltersInvalidError"
  }
}

/** The person_locations value for a target market: "Region, Country", or the country alone. */
export function locationValue(country: string, region?: string | null): string {
  const r = region?.trim()
  return r ? `${r}, ${country.trim()}` : country.trim()
}

const cleanList = (values: string[], max: number) => {
  const out: string[] = []
  for (const value of values) {
    const v = value.trim().replace(/\s+/g, " ")
    if (v && v.length <= 60 && !out.some((o) => o.toLowerCase() === v.toLowerCase())) out.push(v)
  }
  return out.slice(0, max)
}

/** Pure: validated model output + segment + market -> the stored filters. */
export function segmentToSearchFilters(
  output: PeopleFiltersOutput,
  segment: PeopleSearchSegment,
  market: { country: string; region?: string | null }
): CompanySearchFilters {
  const allowedSeniority = new Map(SENIORITY_LEVELS.map((s) => [s.toLowerCase(), s]))
  const seniority = cleanList(output.seniority, 3)
    .map((s) => allowedSeniority.get(s.toLowerCase()))
    .filter((s): s is (typeof SENIORITY_LEVELS)[number] => Boolean(s))
  const location = locationValue(market.country, market.region)
  return {
    label: output.label.trim().toLowerCase().slice(0, 60) || segment.name.toLowerCase(),
    includeKeywords: [],
    excludeKeywords: [],
    industries: knownIndustries(output.industries).slice(0, MAX_INDUSTRIES),
    headcountMin: segment.headcountMin ?? null,
    headcountMax: segment.headcountMax ?? null,
    market: location,
    titles: cleanList(output.titles, MAX_TITLES),
    seniority,
    locations: [location],
  }
}

/** Stored filters -> the options the people search sends. */
export function toPeopleSearchFilters(filters: CompanySearchFilters): PeopleSearchFilters {
  return {
    titles: filters.titles ?? [],
    seniority: filters.seniority ?? [],
    locations: filters.locations ?? [filters.market],
    industries: filters.industries,
    headcountMin: filters.headcountMin,
    headcountMax: filters.headcountMax,
  }
}

export async function generatePeopleSearchFilters({
  segment,
  sellerDescription,
  market,
  llm = getLlmProvider(),
}: {
  segment: PeopleSearchSegment
  sellerDescription?: string | null
  market: { country: string; region?: string | null }
  llm?: LlmProvider
}): Promise<CompanySearchFilters> {
  const request = {
    schema: peopleFiltersOutputSchema,
    maxTokens: 1200,
    system:
      "You turn a sales target segment into filters for a people database search. Pick the current job titles of the person " +
      "at a target company who decides to buy (owners and founders for small businesses, a department head for larger ones). " +
      "Titles are matched against people's current job titles, so use common, plain titles, not descriptions. " +
      `Seniority may only come from: ${SENIORITY_LEVELS.join(", ")}. Leave industries empty unless the segment clearly names one.`,
    prompt:
      `Segment: ${segment.name}\nPain point: ${segment.painPoint}\nCriteria: ${segment.criteria.join(", ")}\n` +
      (sellerDescription ? `The seller (who will contact these people): ${sellerDescription.slice(0, 300)}\n` : ""),
  }
  let lastError = "no output"
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // Validated again here: the schema is the contract whatever the provider does.
      const output = peopleFiltersOutputSchema.parse(await llm.generateStructured(request))
      const filters = segmentToSearchFilters(output, segment, market)
      if ((filters.titles ?? []).length > 0) return filters
      lastError = "no usable job titles"
    } catch (err) {
      lastError = err instanceof Error ? err.message.slice(0, 200) : "invalid output"
    }
  }
  throw new SearchFiltersInvalidError(lastError)
}

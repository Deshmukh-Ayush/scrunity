import { z } from "zod"
import type { CompanySearchFilters } from "@/db/schema"
import { generateStructuredWithFallback } from "@/lib/gtm-ai"
import { COMPANY_INDUSTRIES, knownIndustries } from "@/lib/providers/industries"

/**
 * Turns an ICP segment into a company-database query: what to search for
 * (specific keyword phrases), what to exclude (look-alike businesses that
 * share the words, e.g. staffing "agencies" for a marketing-agency segment),
 * optional industries, size band and market. One LLM call, no vendor call.
 */

export interface SearchSegment {
  name: string
  painPoint: string
  criteria: string[]
  targetKeywords?: string[] | null
  headcountMin?: number | null
  headcountMax?: number | null
}

const MAX_INCLUDE = 6
const MAX_EXCLUDE = 15
const MAX_INDUSTRIES = 3

/**
 * The only terms a search may exclude: kinds of business that share generic
 * words ("agency", "services", "solutions") with many segments but are
 * clearly different businesses. A fixed list, because an exclusion removes
 * every company whose keywords, name or description contain the term, and a
 * free-form one (the model proposed "seo services" for a marketing-agency
 * segment) would remove the very companies searched for.
 */
export const EXCLUDABLE_BUSINESS_TERMS = [
  "staffing", "recruiting", "recruitment", "talent acquisition", "job board", "employment agency", "headhunter",
  "insurance", "real estate", "travel agency", "model agency", "modeling agency", "talent agency",
  "school", "university", "college", "tutoring", "e-learning", "online courses",
  "nonprofit", "non-profit", "charity", "foundation", "church", "government",
  "reseller", "distributor", "wholesale", "manufacturer", "retailer", "franchise",
  "directory", "marketplace", "newsletter", "podcast", "magazine", "publisher", "media company",
] as const

const filtersSchema = z.object({
  label: z.string().describe("What is being searched for, plural and lowercase, at most 5 words, e.g. 'digital marketing agencies'"),
  includeKeywords: z
    .array(z.string())
    .describe(`2 to ${MAX_INCLUDE} specific keyword phrases (1-3 words) a company of this kind tags itself with, e.g. 'digital marketing', 'seo', 'ppc'. Never a generic word on its own such as 'agency', 'services', 'b2b' or 'company'.`),
  excludeKeywords: z
    .array(z.string())
    .describe(`Up to ${MAX_EXCLUDE} terms from the allowed exclusion list naming look-alike businesses that are NOT the segment (e.g. for an agency segment: staffing, recruiting, job board, insurance). Never one that describes the target companies.`),
  industries: z
    .array(z.string())
    .describe(`0 to ${MAX_INDUSTRIES} industries from the allowed list that the target companies belong to; empty when unsure`),
})

const clean = (values: string[], max: number) => {
  const out: string[] = []
  for (const value of values) {
    const v = value.trim().toLowerCase().replace(/\s+/g, " ")
    if (v && v.length <= 40 && !out.includes(v)) out.push(v)
  }
  return out.slice(0, max)
}

/** Singular form of a word, so "agencies" and "agency" compare equal. */
const singular = (w: string) => (w.endsWith("ies") ? `${w.slice(0, -3)}y` : w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w)

/** Lowercase, singular words of a phrase, for overlap checks. */
const wordsOf = (text: string) =>
  new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).map(singular))

/** Used when the LLM call fails: the segment's own keywords, no exclusions. */
export function fallbackSearchFilters(segment: SearchSegment, market: string): CompanySearchFilters {
  return {
    label: segment.name.toLowerCase(),
    includeKeywords: clean(segment.targetKeywords?.length ? segment.targetKeywords : [segment.name], MAX_INCLUDE),
    excludeKeywords: [],
    industries: [],
    headcountMin: segment.headcountMin ?? null,
    headcountMax: segment.headcountMax ?? null,
    market,
  }
}

export async function generateCompanySearchFilters({
  segment,
  sellerDescription,
  market,
}: {
  segment: SearchSegment
  sellerDescription?: string | null
  market: string
}): Promise<CompanySearchFilters> {
  try {
    const out = await generateStructuredWithFallback({
      schema: filtersSchema,
      maxTokens: 1500,
      system:
        "You turn a sales target segment into filters for a company database search. Companies are matched on keyword tags they carry, " +
        "so include keywords must be specific to the kind of business in the segment, and exclude keywords must name the look-alike businesses " +
        "that share generic words with it (for an agency segment: staffing, recruiting, talent, job board, employment; for a software segment: " +
        "reseller, training, school). An exclusion removes every company whose keywords, name or description contain it, so never exclude " +
        "anything that describes the target companies. Exclusions may only come from this list: " +
        EXCLUDABLE_BUSINESS_TERMS.join("; ") +
        ". Industries may only come from this list: " +
        COMPANY_INDUSTRIES.join("; ") +
        ".",
      prompt:
        `Segment: ${segment.name}\nPain point: ${segment.painPoint}\nCriteria: ${segment.criteria.join(", ")}\n` +
        `Keywords given so far: ${(segment.targetKeywords ?? []).join(", ") || "none"}\n` +
        (sellerDescription ? `The seller (who will contact these companies): ${sellerDescription.slice(0, 300)}\n` : ""),
    })
    const include = clean(out.includeKeywords, MAX_INCLUDE)
    const label = out.label.trim().toLowerCase().slice(0, 60) || segment.name.toLowerCase()
    // An exclusion must never knock out the target itself.
    const targetWords = new Set([...include, label].flatMap((p) => [...wordsOf(p)]))
    const allowed = new Set<string>(EXCLUDABLE_BUSINESS_TERMS)
    const exclude = clean(out.excludeKeywords, MAX_EXCLUDE).filter(
      (term) => allowed.has(term) && ![...wordsOf(term)].some((w) => targetWords.has(w))
    )
    if (include.length === 0) return fallbackSearchFilters(segment, market)
    return {
      label,
      includeKeywords: include,
      excludeKeywords: exclude,
      industries: knownIndustries(out.industries).slice(0, MAX_INDUSTRIES),
      headcountMin: segment.headcountMin ?? null,
      headcountMax: segment.headcountMax ?? null,
      market,
    }
  } catch (err) {
    console.warn("[Company Search] Filter generation failed; using the segment keywords:", (err as Error).message)
    return fallbackSearchFilters(segment, market)
  }
}

/**
 * The excluded term a company matches, if any: the same rule the provider
 * documents for its exclusion filter (exact phrase, case-insensitive, against
 * the name, keywords and short description), applied locally as well so the
 * exclusion holds even where the provider ignores it.
 */
export function matchedExcludedTerm(
  company: { name: string; industry?: string | null; description?: string | null },
  excludeKeywords: string[]
): string | null {
  const haystack = ` ${[company.name, company.industry ?? "", company.description ?? ""].join(" | ").toLowerCase()} `
  for (const term of excludeKeywords) {
    const escaped = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    if (new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(haystack)) return term
  }
  return null
}

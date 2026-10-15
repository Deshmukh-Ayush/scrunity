import { z } from "zod"
import { generateStructuredWithFallback } from "@/lib/gtm-ai"

export interface FitInputCompany {
  id: string
  name: string
  industry: string | null
  headcount: number | null
  revenueRange: string | null
  location: string
  description: string
}

export interface FitSegment {
  name: string
  painPoint: string
  criteria: string[]
  headcountMin?: number | null
  headcountMax?: number | null
}

export interface CompanyFit {
  /** 0-100: how well the company matches the segment, from the facts we have. */
  score: number
  /** One short plain line explaining the score. */
  reason: string
}

/**
 * Companies at or above this score are pre-selected at the selection gate;
 * the rest stay visible but unticked. 60 = "likely in the segment".
 */
export const FIT_PRESELECT_THRESHOLD = 60

const MAX_WORDS = 20
// gpt-oss is a reasoning model and its reasoning counts against the output cap
// (reasoning effort is "low", see primaryStructuredOptions). The cap also counts
// against Groq's per-minute token limit, so it stays moderate.
const REASONING_BUDGET = 1200
const TOKENS_PER_COMPANY = 80
const MAX_OUTPUT_TOKENS = 4000

export const companyFitSchema = z.object({
  fits: z.array(
    z.object({
      ref: z.number().describe("The company's number from the list"),
      score: z.number().describe("0 to 100, using the rubric"),
      reason: z.string().describe(`One line, at most ${MAX_WORDS} words`),
    })
  ),
})

export const companyFitMaxTokens = (count: number) =>
  Math.min(MAX_OUTPUT_TOKENS, REASONING_BUDGET + count * TOKENS_PER_COMPANY)

/** Hard word cap, so a model that ignores the instruction still can't overflow the table cell. */
function clampWords(text: string): string {
  const words = text.trim().replace(/\s+/g, " ").split(" ")
  return words.length <= MAX_WORDS ? words.join(" ") : `${words.slice(0, MAX_WORDS).join(" ")}…`
}

const clampScore = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

/** A free-text criterion about company size, e.g. "Team 5-20" or "50-5000 employees". */
const SIZE_CRITERION = /\b(team|employees?|staff|headcount|people|fte)\b/i

/**
 * The segment as the scorer sees it. With a structured size band (the same
 * headcountMin/Max the company search filters on), free-text size criteria
 * are dropped: they can disagree with the band (the live test's segment said
 * "Team 5-20" with a 5-50 band, and agencies of 30-50 were scored down).
 */
export function fitCriteria(segment: FitSegment): string[] {
  const hasBand = segment.headcountMin != null && segment.headcountMax != null
  return hasBand
    ? segment.criteria.filter((c) => !(SIZE_CRITERION.test(c) && /\d/.test(c)))
    : segment.criteria
}

/** The scoring prompt (also replayed by scripts/test-llm-structured-output.ts). */
export function companyFitPrompt(segment: FitSegment, companies: FitInputCompany[]) {
  const list = companies
    .map((c, i) =>
      [
        `${i + 1}. ${c.name}`,
        `industry: ${c.industry ?? "unknown"}`,
        `employees: ${c.headcount ?? "unknown"}`,
        `revenue: ${c.revenueRange ?? "unknown"}`,
        `location: ${c.location}`,
        c.description ? `about: ${c.description.slice(0, 200)}` : null,
      ]
        .filter(Boolean)
        .join(" | ")
    )
    .join("\n")
  const hasBand = segment.headcountMin != null && segment.headcountMax != null
  const band = hasBand ? `\nTarget size: ${segment.headcountMin}-${segment.headcountMax} employees` : ""
  const sizeRule = hasBand
    ? `The search already limited companies to ${segment.headcountMin}-${segment.headcountMax} employees: any size inside that range fits fully and must never lower a score; only a size outside it lowers the score a little. `
    : "Size only slightly outside the target lowers the score a little. "
  return {
    system:
      "You score how well companies match a sales target segment. Use ONLY the facts given for each company and the segment; never invent customers, products or numbers.\n" +
      "Score what kind of business each company is. Rubric: 80-100 = clearly the kind of business the segment describes; " +
      "60-79 = probably that kind of business; 40-59 = the kind of business is unclear from the facts; 0-39 = a different kind of business " +
      "(for example a staffing or recruiting firm, job board, school or training provider, nonprofit or trade association, insurer, " +
      "directory, or a publication or media site, when the segment is not one of those). " +
      "A company's name or industry naming a different business is strong evidence. " +
      "Facts that are not given (revenue, client type, channels) are unknown, not negative: never lower a score because something is missing. " +
      sizeRule +
      `For each company give a score and one plain reason of at most ${MAX_WORDS} words.`,
    prompt:
      `Segment: ${segment.name}\nPain point: ${segment.painPoint}\nCriteria: ${fitCriteria(segment).join(", ") || "none"}${band}\n\n` +
      `Companies:\n${list}`,
  }
}

/**
 * One batched LLM call that scores every company 0-100 against the segment,
 * grounded only in the provider fields we already have (no vendor calls).
 * Returns a map of company id to score and reason; companies the model skipped
 * are absent. Never throws: scores are advisory and the user decides.
 */
export async function generateCompanyFitScores({
  segment,
  companies,
}: {
  segment: FitSegment
  companies: FitInputCompany[]
}): Promise<Map<string, CompanyFit>> {
  const result = new Map<string, CompanyFit>()
  if (companies.length === 0) return result
  try {
    const output = await generateStructuredWithFallback({
      schema: companyFitSchema,
      maxTokens: companyFitMaxTokens(companies.length),
      ...companyFitPrompt(segment, companies),
    })
    for (const { ref, score, reason } of output.fits) {
      const company = companies[ref - 1]
      if (company && Number.isFinite(score)) {
        result.set(company.id, { score: clampScore(score), reason: clampWords(reason || "") })
      }
    }
  } catch (err) {
    console.warn("[Company Fit] Fit scores skipped:", (err as Error).message)
  }
  return result
}

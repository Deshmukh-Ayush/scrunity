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

const MAX_WORDS = 20
// gpt-oss is a reasoning model and its reasoning counts against the cap: a
// 5-company call used ~570 reasoning tokens, so a 500 cap returned no JSON at all.
const REASONING_BUDGET = 1200
const TOKENS_PER_COMPANY = 60
const MAX_OUTPUT_TOKENS = 3000

const fitSchema = z.object({
  fits: z.array(
    z.object({
      ref: z.number().describe("The company's number from the list"),
      fit: z.string().describe(`One line, at most ${MAX_WORDS} words`),
    })
  ),
})

/** Hard word cap, so a model that ignores the instruction still can't overflow the table cell. */
function clampWords(text: string): string {
  const words = text.trim().replace(/\s+/g, " ").split(" ")
  return words.length <= MAX_WORDS
    ? words.join(" ")
    : `${words.slice(0, MAX_WORDS).join(" ")}…`
}

/**
 * One batched LLM call that writes a short "why this company fits" line for
 * every company in a run, grounded only in the provider fields and the chosen
 * segment. Returns a map of company id to line; companies the model skipped are
 * simply absent (the table shows "—"). Never throws: the Fit line is optional.
 */
export async function generateCompanyFitLines({
  segment,
  companies,
}: {
  segment: { name: string; painPoint: string; criteria: string[] }
  companies: FitInputCompany[]
}): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  if (companies.length === 0) return result

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

  try {
    const output = await generateStructuredWithFallback({
      schema: fitSchema,
      maxTokens: Math.min(
        MAX_OUTPUT_TOKENS,
        REASONING_BUDGET + companies.length * TOKENS_PER_COMPANY
      ),
      system:
        "You assess whether companies match a sales target segment. Use ONLY the facts given for each company and the segment. " +
        `For each company write one plain line of at most ${MAX_WORDS} words saying how it fits or doesn't. ` +
        "If the facts are too thin to judge, say so. Never invent customers, funding, products or numbers.",
      prompt:
        `Segment: ${segment.name}\nPain point: ${segment.painPoint}\nCriteria: ${segment.criteria.join(", ")}\n\n` +
        `Companies:\n${list}`,
    })
    for (const { ref, fit } of output.fits) {
      const company = companies[ref - 1]
      if (company && fit.trim()) result.set(company.id, clampWords(fit))
    }
  } catch (err) {
    console.warn("[Company Fit] Fit lines skipped:", (err as Error).message)
  }
  return result
}

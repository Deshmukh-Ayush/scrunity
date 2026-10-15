/**
 * Replays the two structured-output prompts whose primary-model call failed in
 * the database-mode live test (company fit, 14 companies: "No output
 * generated"; job titles: "Failed to validate JSON") and reports, per attempt,
 * the finish reason, reasoning/output tokens and error. Calls the real LLM
 * (Groq); no vendor credits.
 *
 *   npx tsx --tsconfig scripts/support/tsconfig.json scripts/test-llm-structured-output.ts [before|after] [trials]
 *
 * before: the settings the live test ran with (no reasoning effort, output caps 2040 / 500).
 * after:  the settings in src/lib/gtm-ai.ts now (generateStructuredWithFallback's primary call).
 */
import "dotenv/config"
import { generateText, Output } from "ai"
import { z } from "zod"
import { primaryModel, primaryStructuredOptions } from "../src/lib/gtm-ai"
import { companyFitSchema, companyFitMaxTokens, companyFitPrompt } from "../src/lib/gtm-company-fit"
import { JOB_FUNCTION_MAX_TOKENS, jobFunctionPrompt, jobFunctionSchema } from "../src/lib/gtm-ai"

const SEGMENT = {
  name: "Digital Marketing Agencies",
  painPoint:
    "Need high-quality B2B leads and automated outreach to scale client campaigns, but manual prospecting consumes time and budget.",
  criteria: ["Revenue > $500K", "Serves B2B clients", "Team 5-20", "Uses multiple outreach channels"],
}
// The 14 stored companies of the live test (dbtest-51b13f), from its recorded Apollo response.
const COMPANIES: Array<[string, string, number, string]> = [
  ["The Marketing Millennials", "media production", 8, "Austin, Texas, United States"],
  ["Free Online Courses", "e-learning", 14, "Los Alamitos, California, United States"],
  ["Simon Sinek's The Optimism Company", "professional training & coaching", 30, "New York, New York, United States"],
  ["freeCodeCamp", "e-learning", 46, "San Francisco, California, United States"],
  ["Agency of Valor", "insurance", 21, "Dallas, Texas, United States"],
  ["Hire Resolve LLC - The Top Recruitment Agency", "staffing & recruiting", 41, "Scottsdale, Arizona, United States"],
  ["Remotivate", "staffing & recruiting", 19, "Sheridan, Wyoming, United States"],
  ["Pocketbook Agency", "staffing & recruiting", 37, "Beverly Hills, California, United States"],
  ["Method Recruiting, a 3x Inc. 5000 company", "staffing & recruiting", 29, "San Francisco, California, United States"],
  ["World Brand Design Society", "design", 36, "Orlando, Florida, United States"],
  ["Carter Murray", "staffing & recruiting", 34, "De Pere, Wisconsin, United States"],
  ["Talentoma", "staffing & recruiting", 14, "Los Angeles, California, United States"],
  ["Wazaayf.com", "staffing & recruiting", 31, "Cairo, West Virginia, United States"],
  ["Engtal", "staffing & recruiting", 46, "Chicago, Illinois, United States"],
]
const fitCompanies = COMPANIES.map(([name, industry, headcount, location], i) => ({
  id: String(i), name, industry, headcount, revenueRange: null, location, description: "",
}))

// The live test's settings, before this change.
const BEFORE_FIT_SYSTEM =
  "You assess whether companies match a sales target segment. Use ONLY the facts given for each company and the segment. " +
  "For each company write one plain line of at most 20 words saying how it fits or doesn't. " +
  "If the facts are too thin to judge, say so. Never invent customers, funding, products or numbers."
const beforeFitSchema = z.object({
  fits: z.array(z.object({ ref: z.number().describe("The company's number from the list"), fit: z.string().describe("One line, at most 20 words") })),
})
const beforeFitPrompt = () =>
  `Segment: ${SEGMENT.name}\nPain point: ${SEGMENT.painPoint}\nCriteria: ${SEGMENT.criteria.join(", ")}\n\nCompanies:\n` +
  fitCompanies.map((c, i) => `${i + 1}. ${c.name} | industry: ${c.industry} | employees: ${c.headcount} | revenue: unknown | location: ${c.location}`).join("\n")
const BEFORE_JOB_SYSTEM =
  "You are a sales development leader. Given an ICP segment, determine the exact decision-maker roles most likely to purchase or champion a solution for their pain point.\n" +
  "CONCISENESS RULES: Output only 1 to 2 exact job titles and a short search keyword. No explanatory notes, no preamble, no task restatement."

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function attempt(label: string, call: () => Promise<{ finishReason: string; usage: any; ok: boolean }>) {
  // Paced: the free tier allows 8,000 tokens per minute and counts the requested output cap.
  await sleep(Number(process.env.LLM_TEST_PACE_MS ?? 9000))
  const t0 = Date.now()
  try {
    const r = await call()
    console.log(`  ${label}: ${r.ok ? "OK  " : "EMPTY"} finish=${r.finishReason} reasoning=${r.usage?.outputTokenDetails?.reasoningTokens ?? r.usage?.reasoningTokens ?? "?"} output=${r.usage?.outputTokens} ${Date.now() - t0}ms`)
    return r.ok
  } catch (err: any) {
    const cause = err?.cause?.message || err?.responseBody?.slice?.(0, 160) || ""
    console.log(`  ${label}: FAIL ${err?.name}: ${String(err?.message).slice(0, 140)} ${cause ? `| ${String(cause).slice(0, 160)}` : ""} ${Date.now() - t0}ms`)
    return false
  }
}

async function main() {
  const mode = process.argv[2] === "after" ? "after" : "before"
  const trials = Number(process.argv[3] ?? 4)
  let fitOk = 0
  let jobOk = 0
  for (let i = 0; i < trials; i++) {
    console.log(`trial ${i + 1} (${mode})`)
    const fit = await attempt("company fit (14 companies)", async () => {
      const prompt = companyFitPrompt(SEGMENT, fitCompanies)
      const r = await generateText({
        model: primaryModel,
        // Two schema shapes (old fit line vs new score), one call site.
        output: Output.object({ schema: (mode === "before" ? beforeFitSchema : companyFitSchema) as unknown as typeof companyFitSchema }),
        system: mode === "before" ? BEFORE_FIT_SYSTEM : prompt.system,
        prompt: mode === "before" ? beforeFitPrompt() : prompt.prompt,
        maxOutputTokens: mode === "before" ? Math.min(3000, 1200 + 14 * 60) : companyFitMaxTokens(14),
        maxRetries: 0,
        ...(mode === "after" ? primaryStructuredOptions : {}),
      })
      return { finishReason: r.finishReason, usage: r.usage, ok: Boolean(r.output) }
    })
    const job = await attempt("job titles", async () => {
      const r = await generateText({
        model: primaryModel,
        output: Output.object({ schema: jobFunctionSchema }),
        system: mode === "before" ? BEFORE_JOB_SYSTEM : jobFunctionPrompt(SEGMENT).system,
        prompt: jobFunctionPrompt(SEGMENT).prompt,
        maxOutputTokens: mode === "before" ? 500 : JOB_FUNCTION_MAX_TOKENS,
        maxRetries: 0,
        ...(mode === "after" ? primaryStructuredOptions : {}),
      })
      return { finishReason: r.finishReason, usage: r.usage, ok: Boolean(r.output) }
    })
    fitOk += fit ? 1 : 0
    jobOk += job ? 1 : 0
  }
  console.log(`\n${mode}: company fit ${fitOk}/${trials} OK, job titles ${jobOk}/${trials} OK`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })

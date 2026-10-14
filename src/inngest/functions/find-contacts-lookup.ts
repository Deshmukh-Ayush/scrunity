import {
  scrapeUrl,
  searchFirecrawl,
  FirecrawlRateLimitError,
  FirecrawlCallCapExceededError,
  FirecrawlSpendPausedError,
  type FirecrawlRunContext,
} from "@/lib/firecrawl"
import {
  type TeamCandidate,
  parseTeamFromMarkdown,
  parseCandidatesFromSnippets,
  selectMatchingDecisionMaker,
  isValidPersonName,
} from "@/lib/gtm-contact-matcher"
import type { gtmProspectCompany } from "@/db/schema"

/**
 * Legacy Stage 5 Firecrawl lookups for one company, split into three parts so
 * a part that was still rate-limited after its retries can be re-run on its own:
 * - team: site search for a team/about page (+ scrape of that page)
 * - linkedin: LinkedIn snippet search for the target role
 * - site: homepage scrape used to find an on-site email address
 * A rate-limited part is recorded in `incomplete`, never treated as "nothing found".
 */
export type LookupPart = "team" | "linkedin" | "site"
const ALL_PARTS: LookupPart[] = ["team", "linkedin", "site"]

export interface CompanyLookup {
  company: typeof gtmProspectCompany.$inferSelect
  cleanCompanyName: string
  teamCandidates: TeamCandidate[]
  linkedinCandidates: TeamCandidate[]
  siteMarkdown: string
  incomplete: Set<LookupPart>
  rateLimitedCalls: number
}

export interface LookupOptions {
  runContext: FirecrawlRunContext
  targetRole: { jobFunctions: string[]; searchKeyword: string }
  /** Retries per request after a 429 (on top of the first attempt). */
  maxRetries: number
  baseDelayMs?: number
}

export interface DecisionMaker {
  personName: string
  personTitle: string
  linkedinUrl: string | null
}

const isBudgetStop = (err: unknown) =>
  err instanceof FirecrawlCallCapExceededError || err instanceof FirecrawlSpendPausedError

export function cleanCompanyNameOf(name: string) {
  return name
    .replace(/\s*[-–|:].*$/, "")
    .replace(/\s+(Inc|LLC|PLLC|Services|Platform|Practice)$/i, "")
    .trim()
}

export function newCompanyLookup(company: typeof gtmProspectCompany.$inferSelect): CompanyLookup {
  return {
    company,
    cleanCompanyName: cleanCompanyNameOf(company.name),
    teamCandidates: [],
    linkedinCandidates: [],
    siteMarkdown: "",
    incomplete: new Set(),
    rateLimitedCalls: 0,
  }
}

async function runTeamPart(lookup: CompanyLookup, opts: LookupOptions) {
  const { domain, id } = lookup.company
  const retry = { maxRetries: opts.maxRetries, baseDelayMs: opts.baseDelayMs, runContext: opts.runContext }
  const teamQ = `site:${domain} "team" OR "leadership" OR "founder" OR "clinical" OR "director"`
  const teamResults = await searchFirecrawl(teamQ, 2, { ...retry, stepPrefix: `stage5-team-q-${id}` })

  // Snippets are kept even if the team-page scrape below is rate-limited.
  const snippetCandidates = parseCandidatesFromSnippets(teamResults, "site_search_snippet")
  lookup.teamCandidates = snippetCandidates

  const candidates: TeamCandidate[] = []
  const teamResult = teamResults.find((r) =>
    /(team|about|leadership|providers|staff|people)/i.test(r.url)
  )
  if (teamResult) {
    let targetUrl = teamResult.url
    try {
      const parsed = new URL(teamResult.url)
      const segments = parsed.pathname.split("/").filter(Boolean)
      if (segments.length >= 2 && /(our-team|team|about|leadership|staff|providers)/i.test(segments[0])) {
        targetUrl = `${parsed.origin}/${segments[0]}/`
      }
    } catch {
      // keep targetUrl
    }
    const scraped = await scrapeUrl(targetUrl, { ...retry, stepPrefix: `stage5-team-scrape-${id}` })
    if (scraped.markdown) candidates.push(...parseTeamFromMarkdown(scraped.markdown))
  }
  lookup.teamCandidates = [...candidates, ...snippetCandidates]
}

async function runLinkedinPart(lookup: CompanyLookup, opts: LookupOptions) {
  const { domain, id } = lookup.company
  const searchQ = `"${lookup.cleanCompanyName || domain}" ${opts.targetRole.searchKeyword} site:linkedin.com/in`
  const liPeople = await searchFirecrawl(searchQ, 2, {
    maxRetries: opts.maxRetries,
    baseDelayMs: opts.baseDelayMs,
    runContext: opts.runContext,
    stepPrefix: `stage5-li-${id}`,
  })
  lookup.linkedinCandidates = parseCandidatesFromSnippets(liPeople, "linkedin_snippet")
}

async function runSitePart(lookup: CompanyLookup, opts: LookupOptions) {
  const siteScrape = await scrapeUrl(`https://${lookup.company.domain}`, {
    maxRetries: opts.maxRetries,
    baseDelayMs: opts.baseDelayMs,
    runContext: opts.runContext,
    stepPrefix: `stage5-contact-scrape-${lookup.company.id}`,
  })
  lookup.siteMarkdown = siteScrape.markdown || ""
}

const PART_RUNNERS: Record<LookupPart, (l: CompanyLookup, o: LookupOptions) => Promise<void>> = {
  team: runTeamPart,
  linkedin: runLinkedinPart,
  site: runSitePart,
}

/**
 * Runs the given lookup parts. A part that ends rate-limited is added to
 * `incomplete`; one that completes is removed. Other Firecrawl errors keep
 * the old behaviour (that part simply yields nothing). Call-cap and spend-pause
 * errors are rethrown.
 */
export async function runLookupParts(
  lookup: CompanyLookup,
  opts: LookupOptions,
  parts: LookupPart[] = ALL_PARTS
) {
  for (const part of parts) {
    try {
      await PART_RUNNERS[part](lookup, opts)
      lookup.incomplete.delete(part)
    } catch (err) {
      if (isBudgetStop(err)) throw err
      if (err instanceof FirecrawlRateLimitError) {
        lookup.rateLimitedCalls++
        lookup.incomplete.add(part)
        console.warn(
          `[Stage 5] ${part} lookup for ${lookup.company.domain} still rate-limited after retries; marked lookup_incomplete.`
        )
      } else {
        lookup.incomplete.delete(part)
        console.warn(`[Stage 5] ${part} lookup for ${lookup.company.domain} failed:`, (err as Error).message)
      }
    }
  }
}

/** Best matching decision maker from everything found so far, else the company "Team" placeholder. */
export function pickDecisionMaker(lookup: CompanyLookup, jobFunctions: string[]): DecisionMaker {
  const best = selectMatchingDecisionMaker(
    [...lookup.teamCandidates, ...lookup.linkedinCandidates],
    jobFunctions
  )
  if (best && isValidPersonName(best.candidate.name)) {
    return {
      personName: best.candidate.name,
      personTitle: best.candidate.title,
      linkedinUrl: best.candidate.url || null,
    }
  }
  return {
    personName: `${lookup.cleanCompanyName} Team`,
    personTitle: jobFunctions[0] || "Leadership",
    linkedinUrl: null,
  }
}

/** Wait before the retry pass: one full rate-limit window, so the per-minute budget has reset. */
export const RETRY_PASS_COOLDOWN_MS = 60_000
/** The retry pass is slower and more patient than the first pass (maxRetries 1, 1s base). */
export const RETRY_PASS_OPTIONS = { maxRetries: 3, baseDelayMs: 5_000 }

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * End-of-stage retry pass: after a cooldown, re-runs only the parts that were
 * rate-limited, one company at a time with longer backoff. Stops early (leaving
 * the rest incomplete) if the call cap or spend pause is reached, so the retry
 * pass can never fail the stage or exceed the caps. Returns the lookups that are
 * now complete.
 */
export async function retryIncompleteLookups(
  lookups: CompanyLookup[],
  opts: LookupOptions,
  heartbeat: () => Promise<void>,
  cooldownMs = RETRY_PASS_COOLDOWN_MS
): Promise<CompanyLookup[]> {
  const pending = lookups.filter((l) => l.incomplete.size > 0)
  if (pending.length === 0) return []

  console.info(
    `[Stage 5] Retry pass: ${pending.length} compan${pending.length === 1 ? "y has" : "ies have"} rate-limited lookups; retrying in ${Math.round(cooldownMs / 1000)}s.`
  )
  await heartbeat()
  await sleep(cooldownMs)

  const recovered: CompanyLookup[] = []
  for (const lookup of pending) {
    await heartbeat()
    try {
      await runLookupParts(lookup, { ...opts, ...RETRY_PASS_OPTIONS }, [...lookup.incomplete])
    } catch (err) {
      if (!isBudgetStop(err)) throw err
      console.warn(`[Stage 5] Retry pass stopped early: ${(err as Error).message}`)
      break
    }
    if (lookup.incomplete.size === 0) recovered.push(lookup)
  }
  return recovered
}

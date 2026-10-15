import {
  getEmailLookupMaxWaitMs,
  getEmailPollIntervalMs,
  getEmailLookupsPerCampaign,
  getLeadSearchConcurrency,
  getLeadSearchMaxMs,
  getMaxCandidatesPerCompany,
  getMaxCompaniesExamined,
  getProviderMode,
  getTargetVerifiedLeads,
} from "@/lib/providers/config"

/**
 * Hard budgets of one verified-lead search attempt. Every one of them stops
 * the search cleanly with the leads found so far kept. The Firecrawl caps
 * themselves live in lib/firecrawl-spend.ts; the search only checks, before
 * starting a company, that the attempt can still afford that company's worst
 * case (WEB_PEOPLE_CALLS_PER_COMPANY), so it never stops halfway through one.
 */
export interface LeadSearchBudget {
  target: number
  maxCandidatesPerCompany: number
  maxCompaniesExamined: number
  /** Email lookups for this campaign across all attempts (each costs at most 1 credit). */
  maxEmailLookups: number
  /** Companies searched at the same time (each still tries its people one by one). */
  concurrency: number
  /** Longest wait for one lookup's result within an attempt. */
  maxWaitMs: number
  /** Wait before polling started lookups again (an Inngest step sleep). */
  pollIntervalMs: number
  /** Absolute wall-clock limit of the attempt (across all its steps). */
  deadline: number
}

/**
 * Worst-case Firecrawl calls the web people provider makes for one company in
 * one pass: LinkedIn search, then (only when it found nobody usable) a
 * team-page search and that page's scrape.
 */
export const WEB_PEOPLE_CALLS_PER_COMPANY = 3

export function leadSearchBudget(
  campaignTarget: number | null | undefined,
  attemptStartedAt: number = Date.now(),
  overrides: Partial<LeadSearchBudget> = {}
): LeadSearchBudget {
  // Fixture jobs answer at once; live FullEnrich jobs typically take 30-90 s.
  const fixture = getProviderMode() === "fixture"
  return {
    target: getTargetVerifiedLeads(campaignTarget),
    maxCandidatesPerCompany: getMaxCandidatesPerCompany(),
    maxCompaniesExamined: getMaxCompaniesExamined(),
    maxEmailLookups: getEmailLookupsPerCampaign(),
    concurrency: getLeadSearchConcurrency(),
    maxWaitMs: getEmailLookupMaxWaitMs(),
    pollIntervalMs: fixture && !process.env.GTM_EMAIL_POLL_INTERVAL_MS ? 5 : getEmailPollIntervalMs(),
    deadline: attemptStartedAt + getLeadSearchMaxMs(),
    ...overrides,
  }
}

/** Neutral stop codes (stored); lib/data/public-fields.ts maps them for customers. */
export type LeadSearchStopReason =
  | "email_run_budget"
  | "companies_examined_budget"
  | "wall_clock_budget"
  | "email_credit_cap_reached"
  | "email_credits_exhausted"
  | "email_provider_unavailable"
  | "web_search_budget"

export { leadSearchMessage } from "@/lib/lead-search-message"

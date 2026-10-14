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
import type { LookupTiming } from "./email-lookup"

/**
 * Hard budgets of one verified-lead search. Every one of them stops the search
 * cleanly with the leads found so far kept. Firecrawl budgets are not here:
 * the web people provider goes through the existing per-attempt cap and
 * limiter, which this search never raises or bypasses.
 */
export interface LeadSearchBudget {
  target: number
  maxCandidatesPerCompany: number
  maxCompaniesExamined: number
  /** Email lookups for this campaign across all attempts (each costs at most 1 credit). */
  maxEmailLookups: number
  concurrency: number
  timing: LookupTiming
}

export function leadSearchBudget(
  campaignTarget: number | null | undefined,
  startedAt = Date.now(),
  overrides: Partial<LeadSearchBudget> & { pollIntervalMs?: number } = {}
): LeadSearchBudget {
  // Fixture jobs answer at once; live FullEnrich jobs typically take 30-90 s.
  const fixture = getProviderMode() === "fixture"
  const pollIntervalMs = overrides.pollIntervalMs ?? (fixture ? 5 : getEmailPollIntervalMs())
  return {
    target: getTargetVerifiedLeads(campaignTarget),
    maxCandidatesPerCompany: getMaxCandidatesPerCompany(),
    maxCompaniesExamined: getMaxCompaniesExamined(),
    maxEmailLookups: getEmailLookupsPerCampaign(),
    concurrency: getLeadSearchConcurrency(),
    timing: {
      maxWaitMs: getEmailLookupMaxWaitMs(),
      // The first poll waits a little longer: almost no job finishes sooner.
      firstPollMs: Math.round(pollIntervalMs * (fixture ? 1 : 4 / 3)),
      pollIntervalMs,
      deadline: startedAt + getLeadSearchMaxMs(),
    },
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
  | "people_search_failed"

export { leadSearchMessage } from "@/lib/lead-search-message"

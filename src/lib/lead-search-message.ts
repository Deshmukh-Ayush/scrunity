import type { LeadSearchOutcome } from "@/db/schema"

/**
 * Which limit ended the search, in plain words. Keys are both the internal stop
 * codes (server) and the neutral public codes (lib/data/public-fields.ts), so
 * the same sentence comes out on either side.
 */
const LIMIT_WORDS: Record<string, string> = {
  email_run_budget: "the email lookup limit for this campaign was reached",
  email_lookup_run_limit: "the email lookup limit for this campaign was reached",
  email_credit_cap_reached: "this month's email lookup limit was reached",
  email_lookup_monthly_limit: "this month's email lookup limit was reached",
  email_credits_exhausted: "email lookup is unavailable right now",
  email_provider_unavailable: "email lookup is unavailable right now",
  email_lookup_unavailable: "email lookup is unavailable right now",
  companies_examined_budget: "the limit on companies checked per run was reached",
  companies_examined_limit: "the limit on companies checked per run was reached",
  wall_clock_budget: "the time limit for the search was reached",
  time_limit: "the time limit for the search was reached",
  web_search_budget: "the web search limit for this run was reached",
  people_search_failed: "the web search limit for this run was reached",
  web_search_attempt_limit: "the web search limit for this run was reached",
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * The plain sentence shown when Stage 5's verified-lead search ends. Never
 * mentions vendors or credits, never rounds a short result up, and names the
 * limit that stopped it. Pure: safe in client components.
 */
export function leadSearchMessage(
  outcome: Pick<LeadSearchOutcome, "result" | "target" | "verified"> &
    Partial<Pick<LeadSearchOutcome, "stopReason" | "companiesNotReached">>
): string {
  if (outcome.result === "reached_target") return `Reached target (${outcome.verified} verified)`
  if (outcome.result === "out_of_companies") {
    return `Found ${outcome.verified} of ${outcome.target}: no more companies to check. Try widening the region or segment.`
  }
  const why = (outcome.stopReason && LIMIT_WORDS[outcome.stopReason]) || "a search limit was reached"
  const notReached = outcome.companiesNotReached
    ? ` ${plural(outcome.companiesNotReached, "selected company was", "selected companies were")} not reached.`
    : ""
  return `Found ${outcome.verified} of ${outcome.target}: ${why}.${notReached}`
}

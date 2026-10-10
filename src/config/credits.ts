import { PlanTier } from "./billing"

export interface PlanCreditConfig {
  aiCredits: number
  searchCredits: number
}

/**
 * Monthly Credit Allotments per Plan Tier.
 *
 * Credits are pooled at the organization level based on plan tier and paid seat capacity:
 * - Free (1 seat): 50 AI tool calls, 10 web searches
 * - Freelancer (1 paid seat): 300 AI tool calls, 50 web searches
 * - Agency (5 paid seats): 1,500 AI tool calls (300/seat), 250 web searches (50/seat)
 * - Enterprise (Custom/9,999 seats): 50,000 AI tool calls, 10,000 web searches
 */
export const PLAN_CREDIT_ALLOTMENTS: Record<PlanTier, PlanCreditConfig> = {
  free: {
    aiCredits: 0,
    searchCredits: 10,
  },
  pilot: {
    aiCredits: 300,
    searchCredits: 30,
  },
  starter: {
    aiCredits: 600,
    searchCredits: 100,
  },
  growth: {
    aiCredits: 1800,
    searchCredits: 300,
  },
  scale: {
    aiCredits: 5000,
    searchCredits: 800,
  },
  freelancer: {
    aiCredits: 300,
    searchCredits: 50,
  },
  agency: {
    aiCredits: 1800,
    searchCredits: 250,
  },
}

/**
 * Soft-cap Enforcement Flag.
 *
 * When false (current default), credit usage is tracked and displayed against the allotment,
 * but no user action is blocked even if exceeded.
 *
 * When true, requests exceeding credit limits will be blocked.
 */
export const ENFORCE_CREDIT_LIMITS =
  process.env.ENFORCE_CREDIT_LIMITS === "true"

/**
 * Platform Technical Circuit Breaker for Web Search.
 *
 * Independent sliding-window limit protecting Firecrawl & licensed search APIs
 * from runaway execution loops or accidental client bugs.
 * Always enforced regardless of ENFORCE_CREDIT_LIMITS.
 */
export const SEARCH_CIRCUIT_BREAKER_HOURLY_LIMIT = 60

/**
 * Helper to get credit allotment for an organization's plan tier.
 */
export function getPlanCreditAllotments(
  plan: string = "free"
): PlanCreditConfig {
  const tier = (
    plan.toLowerCase() in PLAN_CREDIT_ALLOTMENTS ? plan.toLowerCase() : "free"
  ) as PlanTier
  return PLAN_CREDIT_ALLOTMENTS[tier] || PLAN_CREDIT_ALLOTMENTS.free
}

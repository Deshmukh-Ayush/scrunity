import type { LeadSearchOutcome } from "@/db/schema"

/**
 * The plain sentence shown when Stage 5's verified-lead search ends. Never
 * mentions vendors or credits, and never rounds a short result up. Pure:
 * safe in client components.
 */
export function leadSearchMessage(
  outcome: Pick<LeadSearchOutcome, "result" | "target" | "verified">
): string {
  if (outcome.result === "reached_target") return `Reached target (${outcome.verified} verified)`
  const why = outcome.result === "out_of_companies" ? "no more companies to check" : "budget reached"
  return `Found ${outcome.verified} of ${outcome.target}: ${why}. Try widening the region or segment.`
}

import { outreachCampaignChannel } from "../client"
import { advanceCampaign } from "@/lib/pipeline/stage-state"
import { executeVerifiedLeadSearch } from "@/lib/pipeline/lead-search-executor"
import type { LeadSearchDeps } from "@/lib/pipeline/verified-lead-search"
import { leadSearchMessage } from "@/lib/pipeline/lead-search-budget"
import type { LeadSearchOutcome } from "@/db/schema"
import { safeRealtimePublish } from "./shared"

/** Returned when another attempt owns the stage: the caller reports "skipped". */
export const STAGE_SUPERSEDED = "superseded" as const

/**
 * Stage 5: find decision makers with a vendor-verified email address.
 *
 * Both discovery modes run the same verified-lead search
 * (lib/pipeline/verified-lead-search.ts); they differ only in where people
 * come from (web search in legacy mode, GTM_PEOPLE_PROVIDER in database
 * mode). Emails are never guessed, pattern-matched or scraped: a person
 * without a mailbox-verified address is skipped. The stage then moves on to
 * qualification and drafting with whatever verified leads it found, including
 * none, and stores how the search ended for the UI.
 *
 * This is the in-process path (all steps in one call). The Inngest executor
 * runs the same steps as separate Inngest steps (lib/pipeline/lead-search-steps.ts).
 */
export async function executeFindContacts(
  outreachCampaignId: string,
  deps?: LeadSearchDeps
): Promise<LeadSearchOutcome | typeof STAGE_SUPERSEDED> {
  await safeRealtimePublish(outreachCampaignChannel(outreachCampaignId).started, {
    stage: "find_contacts",
    message: "Finding decision makers with verified email addresses...",
  })

  const outcome = await executeVerifiedLeadSearch(outreachCampaignId, deps)
  if (!outcome) return STAGE_SUPERSEDED
  await completeFindContacts(outreachCampaignId, outcome)
  return outcome
}

/** Moves the campaign on to qualification and drafting once the search has ended. */
export async function completeFindContacts(outreachCampaignId: string, outcome: LeadSearchOutcome) {
  await advanceCampaign(outreachCampaignId, "find_contacts", { currentStage: "write_emails" })
  await safeRealtimePublish(outreachCampaignChannel(outreachCampaignId).completed, {
    stage: "find_contacts",
    summary: leadSearchMessage(outcome),
  })
}

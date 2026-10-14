import { outreachCampaignChannel } from "../client"
import { advanceCampaign } from "@/lib/pipeline/stage-state"
import { executeVerifiedLeadSearch, type LeadSearchDeps } from "@/lib/pipeline/verified-lead-search"
import { leadSearchMessage } from "@/lib/pipeline/lead-search-budget"
import { safeRealtimePublish } from "./shared"

/**
 * Stage 5: find decision makers with a vendor-verified email address.
 *
 * Both discovery modes run the same verified-lead search
 * (lib/pipeline/verified-lead-search.ts); they differ only in where people
 * come from (web discovery in legacy mode, the people provider in database
 * mode). Emails are never guessed, pattern-matched or scraped: a person
 * without a mailbox-verified address is skipped. The stage then moves on to
 * qualification and drafting with whatever verified leads it found, including
 * none, and stores how the search ended for the UI.
 */
export async function executeFindContacts(outreachCampaignId: string, deps?: LeadSearchDeps) {
  await safeRealtimePublish(outreachCampaignChannel(outreachCampaignId).started, {
    stage: "find_contacts",
    message: "Finding decision makers with verified email addresses...",
  })

  const outcome = await executeVerifiedLeadSearch(outreachCampaignId, deps)

  await advanceCampaign(outreachCampaignId, "find_contacts", { currentStage: "write_emails" })
  await safeRealtimePublish(outreachCampaignChannel(outreachCampaignId).completed, {
    stage: "find_contacts",
    summary: leadSearchMessage(outcome),
  })
  return outcome
}

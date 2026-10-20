import { completeFindContacts } from "@/inngest/functions/find-contacts"
import { campaignEmailProvider } from "./lead-search-executor"
import { finishLeadSearch } from "./lead-search-state"
import {
  claimCampaignStageAttempt,
  failCampaign,
  recordStageTiming,
  touchCampaignAttempt,
  type StageAttempt,
} from "./stage-state"
import { runLeadSearchStep, type LeadSearchStepResult } from "./verified-lead-search"

/**
 * Stage 5 for the Inngest executor, as separate short steps (see
 * inngest/functions/pipeline-stages.ts): claim, many search steps with step
 * sleeps between them, finish. Each function is one `step.run` body; none
 * takes an Inngest `step` (nested steps would replay the whole stage).
 */

const reasonOf = (err: unknown) =>
  (err as { failureReason?: string })?.failureReason ||
  (err instanceof Error ? err.message : "Pipeline stage failed")

/** Takes the stage for a new attempt; null when another executor holds it. */
export function claimLeadSearch(campaignId: string): Promise<StageAttempt | null> {
  return claimCampaignStageAttempt(campaignId, "find_contacts")
}

/** One search step. A thrown error fails the stage (for this attempt only) and ends the run. */
export async function leadSearchStep(
  campaignId: string,
  attempt: StageAttempt
): Promise<LeadSearchStepResult | { status: "failed"; reason: string }> {
  try {
    const result = await runLeadSearchStep(campaignId, attempt.attemptId)
    console.log(
      `[Lead search step] campaign ${campaignId}: ${result.status} in ${result.ms} ms (polled ${result.polled}, started ${result.started}, searched ${result.searched})${result.status === "waiting" ? `, next in ${result.waitMs} ms` : ""}`
    )
    if (result.status === "superseded") {
      await recordStageTiming("campaign", campaignId, "find_contacts", new Date(attempt.startedAt), "superseded")
    }
    return result
  } catch (err) {
    const reason = reasonOf(err)
    console.error(`[Pipeline] Campaign ${campaignId}: stage "find_contacts" failed:`, err)
    await failCampaign(campaignId, "find_contacts", reason, attempt.attemptId)
    await recordStageTiming("campaign", campaignId, "find_contacts", new Date(attempt.startedAt), "failed")
    return { status: "failed", reason }
  }
}

/** Stores the outcome, marks unreached companies and moves the campaign to drafting. */
export async function finishLeadSearchStage(
  campaignId: string,
  attempt: StageAttempt
): Promise<"completed" | "skipped"> {
  if (!(await touchCampaignAttempt(campaignId, "find_contacts", attempt.attemptId))) return "skipped"
  const outcome = await finishLeadSearch(campaignId, await campaignEmailProvider(campaignId))
  await completeFindContacts(campaignId, outcome)
  await recordStageTiming("campaign", campaignId, "find_contacts", new Date(attempt.startedAt), "completed")
  console.log(`[Pipeline] Campaign ${campaignId}: stage "find_contacts" completed -> "write_emails"`)
  return "completed"
}

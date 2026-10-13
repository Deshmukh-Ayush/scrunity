import { after } from "next/server"
import { eq } from "drizzle-orm"
import { db } from "@/utils/db"
import { gtmOutreachCampaign, gtmResearchRun } from "@/db/schema"
import { inngest } from "@/inngest/client"
import { executeSendEmails } from "@/inngest/functions/send-emails"
import { CAMPAIGN_STAGE_EVENTS, RESEARCH_STAGE_EVENTS } from "./events"
import { getPipelineExecutor } from "./executor"
import { runCampaignPipeline, runResearchPipeline } from "./runner"

/** Runs work after the response when inside a request, or immediately otherwise. */
function runInBackground(label: string, work: () => Promise<unknown>) {
  const guarded = () =>
    work().catch((err) => console.error(`[Pipeline Dispatch] ${label} crashed:`, err))
  try {
    after(guarded)
  } catch {
    // Not inside a request scope (e.g. a script): just start it.
    void guarded()
  }
}

/**
 * Sends `event` to Inngest; if Inngest rejects or is unreachable, nothing was
 * enqueued, so falling back to the in-process runner cannot double-execute.
 */
async function sendOrRunDirect(
  label: string,
  event: { name: string; data: Record<string, string> },
  runDirect: () => Promise<unknown>
) {
  if (getPipelineExecutor() === "inngest") {
    try {
      await inngest.send(event)
      console.log(`[Pipeline Dispatch] ${label}: sent ${event.name} to Inngest`)
      return "inngest" as const
    } catch (err) {
      console.error(
        `[Pipeline Dispatch] ${label}: inngest.send(${event.name}) failed; running in-process instead.`,
        err
      )
    }
  }
  console.log(`[Pipeline Dispatch] ${label}: running in-process`)
  runInBackground(label, runDirect)
  return "direct" as const
}

/** Starts (or resumes) a research run from its current stage. */
export async function dispatchResearchRun(researchRunId: string) {
  const [run] = await db
    .select({ currentStage: gtmResearchRun.currentStage })
    .from(gtmResearchRun)
    .where(eq(gtmResearchRun.id, researchRunId))
  const eventName =
    run && RESEARCH_STAGE_EVENTS[run.currentStage as keyof typeof RESEARCH_STAGE_EVENTS]
  if (!eventName) return null

  return sendOrRunDirect(
    `research run ${researchRunId}`,
    { name: eventName, data: { researchRunId } },
    () => runResearchPipeline(researchRunId)
  )
}

/** Starts (or resumes) a campaign's stages 4-6 from its current stage. */
export async function dispatchCampaign(outreachCampaignId: string) {
  const [campaign] = await db
    .select({ currentStage: gtmOutreachCampaign.currentStage })
    .from(gtmOutreachCampaign)
    .where(eq(gtmOutreachCampaign.id, outreachCampaignId))
  const eventName =
    campaign && CAMPAIGN_STAGE_EVENTS[campaign.currentStage as keyof typeof CAMPAIGN_STAGE_EVENTS]
  if (!eventName) return null

  return sendOrRunDirect(
    `campaign ${outreachCampaignId}`,
    { name: eventName, data: { outreachCampaignId } },
    () => runCampaignPipeline(outreachCampaignId)
  )
}

/** Starts Stage 7 (throttled sending of approved drafts). */
export function dispatchCampaignSend(outreachCampaignId: string) {
  return sendOrRunDirect(
    `campaign ${outreachCampaignId} send`,
    { name: "gtm/campaign.send_emails", data: { outreachCampaignId } },
    () => executeSendEmails({ outreachCampaignId })
  )
}

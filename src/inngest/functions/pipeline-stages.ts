import { inngest } from "../client"
import {
  runCampaignStage,
  runResearchStage,
  type CampaignStage,
  type ResearchStage,
} from "@/lib/pipeline/runner"
import { CAMPAIGN_STAGE_EVENTS, RESEARCH_STAGE_EVENTS } from "@/lib/pipeline/events"
import { type InngestStep } from "./shared"

/**
 * Inngest executor for pipeline stages 1-6. Each function runs exactly one
 * stage inside a single `step.run`, so a replay never re-executes stage work,
 * and the shared stage runner claims the stage in the DB first so it can't run
 * alongside another executor. Failures mark the run/campaign `failed` (visible
 * in the UI with a retry action) instead of retrying into a stuck row.
 */

function researchStageFunction(stage: ResearchStage, next: ResearchStage | null) {
  return inngest.createFunction(
    {
      id: `gtm-research-stage-${stage.replace(/_/g, "-")}`,
      name: `GTM Research Stage: ${stage}`,
      retries: 0,
      triggers: [{ event: RESEARCH_STAGE_EVENTS[stage] }],
    },
    async ({ event, step }: { event: { data: { researchRunId: string } }; step: InngestStep }) => {
      const { researchRunId } = event.data
      const outcome = await step.run(`run-${stage}`, () => runResearchStage(researchRunId, stage))
      if (outcome === "completed" && next) {
        await step.sendEvent(`trigger-${next}`, {
          name: RESEARCH_STAGE_EVENTS[next],
          data: { researchRunId },
        })
      }
      return { stage, outcome }
    }
  )
}

function campaignStageFunction(stage: CampaignStage, next: CampaignStage | null) {
  return inngest.createFunction(
    {
      id: `gtm-campaign-stage-${stage.replace(/_/g, "-")}`,
      name: `GTM Campaign Stage: ${stage}`,
      retries: 0,
      triggers: [{ event: CAMPAIGN_STAGE_EVENTS[stage] }],
    },
    async ({
      event,
      step,
    }: {
      event: { data: { outreachCampaignId: string } }
      step: InngestStep
    }) => {
      const { outreachCampaignId } = event.data
      const outcome = await step.run(`run-${stage}`, () =>
        runCampaignStage(outreachCampaignId, stage)
      )
      if (outcome === "completed" && next) {
        await step.sendEvent(`trigger-${next}`, {
          name: CAMPAIGN_STAGE_EVENTS[next],
          data: { outreachCampaignId },
        })
      }
      return { stage, outcome }
    }
  )
}

export const pipelineStageFunctions = [
  researchStageFunction("research_company", "research_competitors"),
  researchStageFunction("research_competitors", "define_segments"),
  researchStageFunction("define_segments", null),
  campaignStageFunction("find_companies", "find_contacts"),
  campaignStageFunction("find_contacts", "write_emails"),
  campaignStageFunction("write_emails", null),
]

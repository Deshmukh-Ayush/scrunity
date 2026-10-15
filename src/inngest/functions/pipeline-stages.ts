import { inngest } from "../client"
import {
  runCampaignStage,
  runResearchStage,
  type CampaignStage,
  type ResearchStage,
} from "@/lib/pipeline/runner"
import { CAMPAIGN_STAGE_EVENTS, RESEARCH_STAGE_EVENTS } from "@/lib/pipeline/events"
import {
  claimLeadSearch,
  finishLeadSearchStage,
  leadSearchStep,
} from "@/lib/pipeline/lead-search-steps"
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

/** Upper bound on search steps per attempt; the wall-clock budget ends it long before. */
const MAX_LEAD_SEARCH_STEPS = 300

/**
 * Stage 5 (verified-lead search) as many short steps instead of one long one:
 * a claim, then search steps (each well under a minute: people searches, lookup
 * starts, one poll per running lookup) with `step.sleep` while vendor jobs run,
 * then a finish step. No single step comes near the route's maxDuration.
 * Same function id as before, so no new function appears in Inngest Cloud.
 */
function leadSearchStageFunction() {
  return inngest.createFunction(
    {
      id: "gtm-campaign-stage-find-contacts",
      name: "GTM Campaign Stage: find_contacts",
      retries: 0,
      triggers: [{ event: CAMPAIGN_STAGE_EVENTS.find_contacts }],
    },
    async ({
      event,
      step,
    }: {
      event: { data: { outreachCampaignId: string } }
      step: InngestStep
    }) => {
      const { outreachCampaignId } = event.data
      const attempt = await step.run("claim", () => claimLeadSearch(outreachCampaignId))
      if (!attempt) return { stage: "find_contacts", outcome: "skipped" }

      let status = "continue"
      for (let i = 0; i < MAX_LEAD_SEARCH_STEPS && (status === "continue" || status === "waiting"); i++) {
        const result = await step.run(`search-${i}`, () => leadSearchStep(outreachCampaignId, attempt))
        status = result.status
        if (result.status === "waiting" && result.waitMs > 0) {
          await step.sleep(`wait-${i}`, Math.max(1000, result.waitMs))
        }
      }
      if (status === "failed" || status === "superseded") {
        return { stage: "find_contacts", outcome: status === "failed" ? "failed" : "skipped" }
      }
      const outcome = await step.run("finish", () => finishLeadSearchStage(outreachCampaignId, attempt))
      if (outcome === "completed") {
        await step.sendEvent("trigger-write_emails", {
          name: CAMPAIGN_STAGE_EVENTS.write_emails,
          data: { outreachCampaignId },
        })
      }
      return { stage: "find_contacts", outcome }
    }
  )
}

export const pipelineStageFunctions = [
  researchStageFunction("research_company", "research_competitors"),
  researchStageFunction("research_competitors", "define_segments"),
  researchStageFunction("define_segments", null),
  campaignStageFunction("find_companies", "find_contacts"),
  leadSearchStageFunction(),
  campaignStageFunction("write_emails", null),
]

import { eq } from "drizzle-orm"
import { db } from "@/utils/db"
import { gtmOutreachCampaign, gtmResearchRun } from "@/db/schema"
import { executeResearchCompany } from "@/inngest/functions/research-company"
import { executeExploreCompetitors } from "@/inngest/functions/explore-competitors"
import { executeDefineSegments } from "@/inngest/functions/define-segments"
import { executeFindCompanies } from "@/inngest/functions/find-companies"
import { executeFindContacts, STAGE_SUPERSEDED } from "@/inngest/functions/find-contacts"
import { executeWriteEmails } from "@/inngest/functions/write-emails"
import { executeQualifyCampaignContacts } from "@/lib/gtm-stage-5-5"
import { isImportCampaign } from "@/lib/contact-import/campaign-stage"
import {
  advanceCampaign,
  claimCampaignStageAttempt,
  claimResearchStage,
  failCampaign,
  failResearchRun,
  recordStageTiming,
} from "./stage-state"

/**
 * The single definition of how each pipeline stage runs. Both executors use it:
 * the in-process runner below (local dev) and the Inngest stage functions
 * (src/inngest/functions/pipeline-stages.ts). Each stage's execute function
 * advances `currentStage` itself, via a forward-only conditional update.
 */
export const RESEARCH_STAGES = {
  research_company: { run: (id: string) => executeResearchCompany(id), next: "research_competitors" },
  research_competitors: { run: (id: string) => executeExploreCompetitors(id), next: "define_segments" },
  define_segments: { run: (id: string) => executeDefineSegments(id), next: "done" },
} as const

export const CAMPAIGN_STAGES = {
  find_companies: { run: (id: string) => executeFindCompanies(id), next: "find_contacts" },
  // An imported list's people are already known (e.g. after Restart Stage): nothing to search.
  find_contacts: {
    run: async (id: string) =>
      (await isImportCampaign(id))
        ? advanceCampaign(id, "find_contacts", { currentStage: "write_emails" })
        : executeFindContacts(id),
    next: "write_emails",
  },
  // Stage 5.5 qualification gates always run immediately before drafting.
  write_emails: {
    run: async (id: string) => {
      await executeQualifyCampaignContacts(id)
      return executeWriteEmails(id)
    },
    next: "awaiting_approval",
  },
} as const

export type ResearchStage = keyof typeof RESEARCH_STAGES
export type CampaignStage = keyof typeof CAMPAIGN_STAGES

/**
 * - `completed`: this executor ran the stage and the row moved to the next stage.
 * - `skipped`: another executor owns the stage, or the row is no longer at it.
 * - `failed`: the stage threw or ended without advancing; the row is now `failed`.
 */
export type StageOutcome = "completed" | "skipped" | "failed"

const reasonOf = (err: unknown) =>
  (err as { failureReason?: string })?.failureReason ||
  (err instanceof Error ? err.message : "Pipeline stage failed")

async function runClaimedStage({
  label,
  id,
  stage,
  claim,
  execute,
  readState,
  fail,
  recordTiming,
}: {
  label: string
  id: string
  stage: string
  claim: () => Promise<boolean>
  execute: () => Promise<unknown>
  readState: () => Promise<{ currentStage: string; status: string } | undefined>
  fail: (reason: string) => Promise<void>
  recordTiming: (startedAt: Date, outcome: StageOutcome) => Promise<void>
}): Promise<StageOutcome> {
  if (!(await claim())) {
    console.warn(
      `[Pipeline Guard] ${label} ${id}: stage "${stage}" is not claimable (already running, already advanced, or not in progress). Skipping.`
    )
    return "skipped"
  }

  console.log(`[Pipeline] ${label} ${id}: running stage "${stage}"`)
  const startedAt = new Date()
  const outcome = await executeClaimed({ label, id, stage, execute, readState, fail })
  await recordTiming(startedAt, outcome).catch((err) =>
    console.warn(`[Pipeline] ${label} ${id}: could not record stage timing:`, err)
  )
  return outcome
}

async function executeClaimed({
  label,
  id,
  stage,
  execute,
  readState,
  fail,
}: {
  label: string
  id: string
  stage: string
  execute: () => Promise<unknown>
  readState: () => Promise<{ currentStage: string; status: string } | undefined>
  fail: (reason: string) => Promise<void>
}): Promise<StageOutcome> {
  try {
    if ((await execute()) === STAGE_SUPERSEDED) {
      // A restart or another executor took the stage over: leave the row to it.
      console.warn(`[Pipeline Guard] ${label} ${id}: stage "${stage}" was taken over by a newer attempt. Stopping.`)
      return "skipped"
    }
  } catch (err) {
    const reason = reasonOf(err)
    console.error(`[Pipeline] ${label} ${id}: stage "${stage}" failed:`, err)
    await fail(reason)
    return "failed"
  }

  const after = await readState()
  if (after?.status === "failed") return "failed"
  if (after?.currentStage === stage) {
    // The stage returned without moving the row on; surface it instead of
    // leaving a silent "in progress" row that nothing is working on.
    const reason = `Stage "${stage}" finished without advancing the pipeline`
    console.error(`[Pipeline] ${label} ${id}: ${reason}`)
    await fail(reason)
    return "failed"
  }
  console.log(`[Pipeline] ${label} ${id}: stage "${stage}" completed -> "${after?.currentStage}"`)
  return "completed"
}

/** Runs one research-run stage if this caller can claim it. */
export function runResearchStage(researchRunId: string, stage: ResearchStage) {
  return runClaimedStage({
    label: "Research run",
    id: researchRunId,
    stage,
    claim: () => claimResearchStage(researchRunId, stage),
    execute: () => RESEARCH_STAGES[stage].run(researchRunId),
    readState: async () =>
      (
        await db
          .select({ currentStage: gtmResearchRun.currentStage, status: gtmResearchRun.status })
          .from(gtmResearchRun)
          .where(eq(gtmResearchRun.id, researchRunId))
      )[0],
    fail: (reason) => failResearchRun(researchRunId, stage, reason),
    recordTiming: (startedAt, outcome) =>
      recordStageTiming("research_run", researchRunId, stage, startedAt, outcome),
  })
}

/** Runs one campaign stage if this caller can claim it. */
export function runCampaignStage(campaignId: string, stage: CampaignStage) {
  let attemptId: string | undefined
  return runClaimedStage({
    label: "Campaign",
    id: campaignId,
    stage,
    claim: async () => {
      attemptId = (await claimCampaignStageAttempt(campaignId, stage))?.attemptId
      return Boolean(attemptId)
    },
    execute: () => CAMPAIGN_STAGES[stage].run(campaignId),
    readState: async () =>
      (
        await db
          .select({
            currentStage: gtmOutreachCampaign.currentStage,
            status: gtmOutreachCampaign.status,
          })
          .from(gtmOutreachCampaign)
          .where(eq(gtmOutreachCampaign.id, campaignId))
      )[0],
    // Only while this attempt owns the stage: never fail a newer attempt's row.
    fail: (reason) => failCampaign(campaignId, stage, reason, attemptId),
    recordTiming: (startedAt, outcome) => recordStageTiming("campaign", campaignId, stage, startedAt, outcome),
  })
}

const isResearchStage = (stage: string): stage is ResearchStage => stage in RESEARCH_STAGES
const isCampaignStage = (stage: string): stage is CampaignStage => stage in CAMPAIGN_STAGES

// Per-process guard so repeated triggers in the same server don't even attempt
// the DB claim concurrently; the claim is what actually guarantees exclusivity.
const activeResearchRuns = new Set<string>()
const activeCampaignRuns = new Set<string>()

/** In-process executor: runs stages 1-3 back to back from the run's current stage. */
export async function runResearchPipeline(researchRunId: string) {
  if (activeResearchRuns.has(researchRunId)) return
  activeResearchRuns.add(researchRunId)
  try {
    for (;;) {
      const [run] = await db
        .select({ currentStage: gtmResearchRun.currentStage, status: gtmResearchRun.status })
        .from(gtmResearchRun)
        .where(eq(gtmResearchRun.id, researchRunId))
      if (!run || run.status !== "in_progress" || !isResearchStage(run.currentStage)) break
      if ((await runResearchStage(researchRunId, run.currentStage)) !== "completed") break
    }
  } finally {
    activeResearchRuns.delete(researchRunId)
  }
}

/** In-process executor: runs stages 4-6 back to back, stopping at human review. */
export async function runCampaignPipeline(campaignId: string) {
  if (activeCampaignRuns.has(campaignId)) return
  activeCampaignRuns.add(campaignId)
  try {
    for (;;) {
      const [campaign] = await db
        .select({
          currentStage: gtmOutreachCampaign.currentStage,
          status: gtmOutreachCampaign.status,
        })
        .from(gtmOutreachCampaign)
        .where(eq(gtmOutreachCampaign.id, campaignId))
      if (!campaign || campaign.status !== "in_progress" || !isCampaignStage(campaign.currentStage)) {
        break
      }
      if ((await runCampaignStage(campaignId, campaign.currentStage)) !== "completed") break
    }
  } finally {
    activeCampaignRuns.delete(campaignId)
  }
}

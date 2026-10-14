import { and, eq, isNull, lt, ne, or, type AnyColumn } from "drizzle-orm"
import { db } from "@/utils/db"
import { gtmOutreachCampaign, gtmResearchRun } from "@/db/schema"

export type ResearchRunStage = typeof gtmResearchRun.$inferSelect.currentStage
export type CampaignStageValue = typeof gtmOutreachCampaign.$inferSelect.currentStage

/**
 * How long a stage may go without a heartbeat (`lastProgressAt`) before it is
 * considered dead. A stage can only be claimed — by a second executor, a retry,
 * or "Restart Stage" — once its previous heartbeat is older than this. Matches
 * the default staleness threshold the UI uses to show "Stalled".
 */
export const STAGE_LEASE_MS = 3 * 60 * 1000

const leaseExpired = (column: AnyColumn) =>
  or(isNull(column), lt(column, new Date(Date.now() - STAGE_LEASE_MS)))

/**
 * SQL condition: nobody is (or is about to be) working on the row — it is not
 * in_progress, or both its last heartbeat and its stage start are older than
 * the lease. Checking the stage start too means a stage that was just started
 * or restarted (not yet picked up, so no heartbeat) still counts as busy, so a
 * second restart or re-run right after the first is refused. Restarts, re-runs
 * and edits that reset a stage must require this.
 */
export function researchRunIsIdle() {
  return or(
    ne(gtmResearchRun.status, "in_progress"),
    and(leaseExpired(gtmResearchRun.lastProgressAt), leaseExpired(gtmResearchRun.stageStartedAt))
  )
}

export function campaignIsIdle() {
  return or(
    ne(gtmOutreachCampaign.status, "in_progress"),
    and(
      leaseExpired(gtmOutreachCampaign.lastProgressAt),
      leaseExpired(gtmOutreachCampaign.stageStartedAt)
    )
  )
}

// ---------------------------------------------------------------------------
// Research runs (stages 1-3)
// ---------------------------------------------------------------------------

/**
 * Atomically takes ownership of a research-run stage. Succeeds only if the run
 * is still in_progress at `stage` and no executor has heartbeated recently, so
 * two executors (or a retry racing the original) can never run it at once.
 * Every claim is a new stage attempt, so it also starts a fresh Firecrawl
 * attempt budget (the lifetime count is kept; see lib/firecrawl-spend.ts).
 */
export async function claimResearchStage(researchRunId: string, stage: ResearchRunStage) {
  const now = new Date()
  const claimed = await db
    .update(gtmResearchRun)
    .set({ lastProgressAt: now, firecrawlAttemptCallCount: 0 })
    .where(
      and(
        eq(gtmResearchRun.id, researchRunId),
        eq(gtmResearchRun.currentStage, stage),
        eq(gtmResearchRun.status, "in_progress"),
        leaseExpired(gtmResearchRun.lastProgressAt)
      )
    )
    .returning({ id: gtmResearchRun.id })
  return claimed.length > 0
}

/**
 * Moves a research run forward from `fromStage`. Conditional on the run still
 * being at `fromStage`, so a stale or duplicate execution can never rewind or
 * skip a run that has already moved on. Returns whether the write applied.
 */
export async function advanceResearchRun(
  researchRunId: string,
  fromStage: ResearchRunStage,
  set: Partial<typeof gtmResearchRun.$inferInsert> & { currentStage: ResearchRunStage }
) {
  const updated = await db
    .update(gtmResearchRun)
    .set({ ...set, stageStartedAt: new Date(), lastProgressAt: null })
    .where(and(eq(gtmResearchRun.id, researchRunId), eq(gtmResearchRun.currentStage, fromStage)))
    .returning({ id: gtmResearchRun.id })
  return updated.length > 0
}

/** Marks a research run failed at `stage` (no-op if it already moved on). */
export async function failResearchRun(
  researchRunId: string,
  stage: ResearchRunStage,
  failureReason: string
) {
  await db
    .update(gtmResearchRun)
    .set({ status: "failed", failureReason })
    .where(and(eq(gtmResearchRun.id, researchRunId), eq(gtmResearchRun.currentStage, stage)))
}

// ---------------------------------------------------------------------------
// Outreach campaigns (stages 4-6)
// ---------------------------------------------------------------------------

/** Campaign equivalent of claimResearchStage. */
export async function claimCampaignStage(campaignId: string, stage: CampaignStageValue) {
  const now = new Date()
  const claimed = await db
    .update(gtmOutreachCampaign)
    .set({ lastProgressAt: now, firecrawlAttemptCallCount: 0 })
    .where(
      and(
        eq(gtmOutreachCampaign.id, campaignId),
        eq(gtmOutreachCampaign.currentStage, stage),
        eq(gtmOutreachCampaign.status, "in_progress"),
        leaseExpired(gtmOutreachCampaign.lastProgressAt)
      )
    )
    .returning({ id: gtmOutreachCampaign.id })
  return claimed.length > 0
}

/** Campaign equivalent of advanceResearchRun. */
export async function advanceCampaign(
  campaignId: string,
  fromStage: CampaignStageValue,
  set: Partial<typeof gtmOutreachCampaign.$inferInsert> & { currentStage: CampaignStageValue }
) {
  const updated = await db
    .update(gtmOutreachCampaign)
    .set({ ...set, stageStartedAt: new Date(), lastProgressAt: null })
    .where(
      and(eq(gtmOutreachCampaign.id, campaignId), eq(gtmOutreachCampaign.currentStage, fromStage))
    )
    .returning({ id: gtmOutreachCampaign.id })
  return updated.length > 0
}

/** Marks a campaign failed at `stage` (no-op if it already moved on). */
export async function failCampaign(
  campaignId: string,
  stage: CampaignStageValue,
  failureReason: string
) {
  await db
    .update(gtmOutreachCampaign)
    .set({ status: "failed", failureReason })
    .where(and(eq(gtmOutreachCampaign.id, campaignId), eq(gtmOutreachCampaign.currentStage, stage)))
}

/** Heartbeat for long campaign loops that make no Firecrawl calls (LLM drafting, enrichment). */
export async function touchCampaignProgress(campaignId: string) {
  await db
    .update(gtmOutreachCampaign)
    .set({ lastProgressAt: new Date() })
    .where(eq(gtmOutreachCampaign.id, campaignId))
}

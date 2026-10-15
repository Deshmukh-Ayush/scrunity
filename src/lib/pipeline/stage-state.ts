import { and, eq, isNull, lt, ne, or, sql, type AnyColumn } from "drizzle-orm"
import { db } from "@/utils/db"
import crypto from "crypto"
import {
  gtmOutreachCampaign,
  gtmResearchRun,
  type StageTimingAttempt,
  type StageTimings,
} from "@/db/schema"

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

export interface StageAttempt {
  attemptId: string
  /** ISO time the attempt claimed the stage. */
  startedAt: string
}

/**
 * Campaign equivalent of claimResearchStage. Also stamps a new attempt id on
 * the row, so work split across several steps (Stage 5) can tell when a
 * restart or another executor has taken the stage over.
 */
export async function claimCampaignStageAttempt(
  campaignId: string,
  stage: CampaignStageValue
): Promise<StageAttempt | null> {
  const now = new Date()
  const attemptId = crypto.randomUUID()
  const claimed = await db
    .update(gtmOutreachCampaign)
    .set({
      lastProgressAt: now,
      firecrawlAttemptCallCount: 0,
      stageAttemptId: attemptId,
      stageAttemptStartedAt: now,
    })
    .where(
      and(
        eq(gtmOutreachCampaign.id, campaignId),
        eq(gtmOutreachCampaign.currentStage, stage),
        eq(gtmOutreachCampaign.status, "in_progress"),
        leaseExpired(gtmOutreachCampaign.lastProgressAt)
      )
    )
    .returning({ id: gtmOutreachCampaign.id })
  return claimed.length > 0 ? { attemptId, startedAt: now.toISOString() } : null
}

export async function claimCampaignStage(campaignId: string, stage: CampaignStageValue) {
  return (await claimCampaignStageAttempt(campaignId, stage)) !== null
}

/**
 * Heartbeat that only lands while `attemptId` still owns the stage. Returns
 * false when the attempt was superseded (restart, failure, stage moved on):
 * the caller must stop without writing anything else.
 */
export async function touchCampaignAttempt(
  campaignId: string,
  stage: CampaignStageValue,
  attemptId: string
): Promise<boolean> {
  const touched = await db
    .update(gtmOutreachCampaign)
    .set({ lastProgressAt: new Date() })
    .where(
      and(
        eq(gtmOutreachCampaign.id, campaignId),
        eq(gtmOutreachCampaign.currentStage, stage),
        eq(gtmOutreachCampaign.status, "in_progress"),
        eq(gtmOutreachCampaign.stageAttemptId, attemptId)
      )
    )
    .returning({ id: gtmOutreachCampaign.id })
  return touched.length > 0
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

/**
 * Marks a campaign failed at `stage` (no-op if it already moved on). With
 * `attemptId`, only while that attempt still owns the stage, so a superseded
 * attempt can never fail the attempt that replaced it.
 */
export async function failCampaign(
  campaignId: string,
  stage: CampaignStageValue,
  failureReason: string,
  attemptId?: string
) {
  await db
    .update(gtmOutreachCampaign)
    .set({ status: "failed", failureReason })
    .where(
      and(
        eq(gtmOutreachCampaign.id, campaignId),
        eq(gtmOutreachCampaign.currentStage, stage),
        attemptId ? eq(gtmOutreachCampaign.stageAttemptId, attemptId) : undefined
      )
    )
}

/** Heartbeat for long campaign loops that make no Firecrawl calls (LLM drafting, enrichment). */
export async function touchCampaignProgress(campaignId: string) {
  await db
    .update(gtmOutreachCampaign)
    .set({ lastProgressAt: new Date() })
    .where(eq(gtmOutreachCampaign.id, campaignId))
}

/**
 * One stage attempt's wall-clock span, appended to the stage's list in
 * stage_timings (every attempt is kept). A value written before attempts were
 * kept (a single object) becomes the first element of the list.
 */
export async function recordStageTiming(
  table: "campaign" | "research_run",
  id: string,
  stage: string,
  startedAt: Date,
  outcome: string
) {
  const endedAt = new Date()
  const entry = JSON.stringify({
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    ms: endedAt.getTime() - startedAt.getTime(),
    outcome,
  })
  const target = table === "campaign" ? gtmOutreachCampaign : gtmResearchRun
  const timings = sql`coalesce(${target.stageTimings}, '{}'::jsonb)`
  const previous = sql`${timings} -> ${stage}::text`
  await db
    .update(target)
    .set({
      stageTimings: sql`jsonb_set(${timings}, array[${stage}::text], (
        CASE jsonb_typeof(${previous})
          WHEN 'array' THEN ${previous}
          WHEN 'object' THEN jsonb_build_array(${previous})
          ELSE '[]'::jsonb
        END
      ) || jsonb_build_array(${entry}::jsonb))`,
    })
    .where(eq(target.id, id))
}

/** Every recorded attempt of a stage, oldest first (handles the old single-object form). */
export function stageTimingAttempts(timings: StageTimings | null | undefined, stage: string): StageTimingAttempt[] {
  const value = timings?.[stage]
  if (!value) return []
  return Array.isArray(value) ? value : [value]
}

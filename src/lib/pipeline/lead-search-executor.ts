import crypto from "crypto"
import { eq } from "drizzle-orm"
import { db } from "@/utils/db"
import { gtmOutreachCampaign } from "@/db/schema"
import { getEmailEnrichmentProvider } from "@/lib/providers/registry"
import { finishLeadSearch } from "./lead-search-state"
import { runLeadSearchStep, type LeadSearchDeps } from "./verified-lead-search"

/**
 * The in-process executor's Stage 5: the same steps in sequence, with plain
 * sleeps between them, then the outcome. Returns null when another attempt
 * took the stage over (nothing is finished or advanced then).
 */
export async function executeVerifiedLeadSearch(campaignId: string, deps: LeadSearchDeps = {}) {
  const [row] = await db
    .select({ attemptId: gtmOutreachCampaign.stageAttemptId })
    .from(gtmOutreachCampaign)
    .where(eq(gtmOutreachCampaign.id, campaignId))
  let attemptId = row?.attemptId
  if (!attemptId) {
    // Called without a claim (scripts): take ownership for this run.
    attemptId = crypto.randomUUID()
    await db
      .update(gtmOutreachCampaign)
      .set({ stageAttemptId: attemptId, stageAttemptStartedAt: new Date() })
      .where(eq(gtmOutreachCampaign.id, campaignId))
  }
  for (let step = 0; ; step++) {
    const r = await runLeadSearchStep(campaignId, attemptId, deps)
    ;(deps.log ?? console.log)(`[Lead search ${campaignId}] step ${step}: ${r.status} in ${r.ms} ms (polled ${r.polled}, started ${r.started}, searched ${r.searched})`)
    if (r.status === "superseded") return null
    if (r.status === "done") break
    if (r.waitMs > 0) await new Promise((resolve) => setTimeout(resolve, r.waitMs))
  }
  const outcome = await finishLeadSearch(campaignId, deps.email ?? getEmailEnrichmentProvider())
  ;(deps.log ?? console.log)(`[Lead search ${campaignId}] done: ${JSON.stringify(outcome)}`)
  return outcome
}

import "server-only"
import { and, eq, inArray, notInArray, sql } from "drizzle-orm"
import { db } from "@/utils/db"
import { gtmContact, gtmContactImportRow, gtmEmailDraft, gtmOutreachCampaign } from "@/db/schema"
import { deliveryCounts, PAUSED_BOUNCE_RATE, planBounceRecovery, shouldPauseForBounces, type GuardDraft } from "./bounce-guard"

/**
 * The bounce-rate pause for imported-list campaigns (rules in bounce-guard.ts).
 * Sent = drafts that left the mailbox; bounced = those with a recorded
 * "bounced" event (Stage 8, lib/reply-polling/record-bounce.ts).
 */

async function loadGuardDrafts(campaignId: string): Promise<GuardDraft[]> {
  return db
    .select({
      id: gtmEmailDraft.id,
      contactId: gtmEmailDraft.contactId,
      status: gtmEmailDraft.status,
      sentAt: gtmEmailDraft.sentAt,
      hasBounced: sql<boolean>`EXISTS (SELECT 1 FROM gtm_email_event e WHERE e.email_draft_id = ${gtmEmailDraft.id} AND e.type = 'bounced')`,
    })
    .from(gtmEmailDraft)
    .where(eq(gtmEmailDraft.outreachCampaignId, campaignId))
}

async function loadGuardCampaign(campaignId: string) {
  const [campaign] = await db
    .select({
      importId: gtmOutreachCampaign.sourceImportId,
      status: gtmOutreachCampaign.status,
      since: gtmOutreachCampaign.bounceGuardSince,
    })
    .from(gtmOutreachCampaign)
    .where(eq(gtmOutreachCampaign.id, campaignId))
  return campaign ?? null
}

/**
 * Pauses an imported-list campaign whose bounce rate is too high. Returns true
 * when the campaign is (now) paused. Other campaigns are never touched: their
 * addresses were verified at mailbox level.
 */
export async function pauseIfBounceRateHigh(campaignId: string): Promise<boolean> {
  const campaign = await loadGuardCampaign(campaignId)
  if (!campaign?.importId) return false
  if (campaign.status === PAUSED_BOUNCE_RATE) return true
  const stats = deliveryCounts(await loadGuardDrafts(campaignId), campaign.since)
  if (!shouldPauseForBounces(stats)) return false
  await db
    .update(gtmOutreachCampaign)
    .set({ status: PAUSED_BOUNCE_RATE, failureReason: PAUSED_BOUNCE_RATE })
    .where(
      and(
        eq(gtmOutreachCampaign.id, campaignId),
        notInArray(gtmOutreachCampaign.status, ["failed", PAUSED_BOUNCE_RATE])
      )
    )
  console.warn(`[Bounce guard] campaign ${campaignId} paused: ${stats.bounced} of ${stats.sent} sent emails bounced`)
  return true
}

export type BounceRecoveryResult =
  | { ok: true; removed: number; next: "send" | "review" | "done"; approvedRemaining: number }
  | { ok: false; reason: "not_paused" }

/**
 * Removes the bounced addresses from a paused campaign and its list, then
 * lifts the pause with a fresh baseline. People stay as contact rows (reply
 * threading and the hard-bounce suppression read them) but never get another
 * email: their waiting drafts are rejected and their list rows deleted.
 * The caller dispatches sending when `next` is "send".
 */
export async function removeBouncedAndResume(campaignId: string): Promise<BounceRecoveryResult> {
  const campaign = await loadGuardCampaign(campaignId)
  if (!campaign || campaign.status !== PAUSED_BOUNCE_RATE) return { ok: false, reason: "not_paused" }
  const plan = planBounceRecovery(await loadGuardDrafts(campaignId))

  if (plan.draftIdsToReject.length > 0) {
    await db
      .update(gtmEmailDraft)
      .set({ status: "rejected", errorMessage: "Removed: an email to this address bounced." })
      .where(inArray(gtmEmailDraft.id, plan.draftIdsToReject))
  }
  if (campaign.importId && plan.bouncedContactIds.length > 0) {
    const emails = (
      await db.select({ email: gtmContact.email }).from(gtmContact).where(inArray(gtmContact.id, plan.bouncedContactIds))
    ).flatMap((c) => (c.email ? [c.email.toLowerCase()] : []))
    if (emails.length > 0) {
      await db
        .delete(gtmContactImportRow)
        .where(and(eq(gtmContactImportRow.importId, campaign.importId), inArray(gtmContactImportRow.email, emails)))
    }
  }

  const now = new Date()
  const resumed =
    plan.next === "send"
      ? { currentStage: "send_emails" as const, status: "in_progress", stageStartedAt: now, lastProgressAt: null }
      : plan.next === "review"
        ? { currentStage: "awaiting_approval" as const, status: "awaiting_approval" }
        : { currentStage: "done" as const, status: "done" }
  // Only lifts a pause that is still in place, so a double submit changes nothing twice.
  const updated = await db
    .update(gtmOutreachCampaign)
    .set({ ...resumed, failureReason: null, bounceGuardSince: now })
    .where(and(eq(gtmOutreachCampaign.id, campaignId), eq(gtmOutreachCampaign.status, PAUSED_BOUNCE_RATE)))
    .returning({ id: gtmOutreachCampaign.id })
  if (updated.length === 0) return { ok: false, reason: "not_paused" }

  console.log(`[Bounce guard] campaign ${campaignId}: removed ${plan.bouncedContactIds.length} bounced, next ${plan.next}`)
  return { ok: true, removed: plan.bouncedContactIds.length, next: plan.next, approvedRemaining: plan.approvedRemaining }
}

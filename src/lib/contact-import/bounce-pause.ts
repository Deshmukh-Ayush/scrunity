import "server-only"
import { and, eq, notInArray, sql } from "drizzle-orm"
import { db } from "@/utils/db"
import { gtmOutreachCampaign } from "@/db/schema"
import { PAUSED_BOUNCE_RATE, shouldPauseForBounces } from "./bounce-guard"

/**
 * The bounce-rate pause for imported-list campaigns (rule in bounce-guard.ts).
 * Sent = drafts that left the mailbox; bounced = those with a recorded
 * "bounced" event (Stage 8, lib/reply-polling/record-bounce.ts).
 */
export async function campaignBounceStats(campaignId: string): Promise<{ sent: number; bounced: number }> {
  const result = await db.execute(sql`
    SELECT count(*)::int AS sent,
           count(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM gtm_email_event e WHERE e.email_draft_id = d.id AND e.type = 'bounced'
           ))::int AS bounced
    FROM gtm_email_draft d
    WHERE d.outreach_campaign_id = ${campaignId} AND (d.sent_at IS NOT NULL OR d.status = 'sent')
  `)
  const row = result.rows[0] as { sent?: unknown; bounced?: unknown } | undefined
  return { sent: Number(row?.sent) || 0, bounced: Number(row?.bounced) || 0 }
}

/**
 * Pauses an imported-list campaign whose bounce rate is too high. Returns true
 * when the campaign is (now) paused. Other campaigns are never touched: their
 * addresses were verified at mailbox level.
 */
export async function pauseIfBounceRateHigh(campaignId: string): Promise<boolean> {
  const [campaign] = await db
    .select({ importId: gtmOutreachCampaign.sourceImportId, status: gtmOutreachCampaign.status })
    .from(gtmOutreachCampaign)
    .where(eq(gtmOutreachCampaign.id, campaignId))
  if (!campaign?.importId) return false
  if (campaign.status === PAUSED_BOUNCE_RATE) return true
  const stats = await campaignBounceStats(campaignId)
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

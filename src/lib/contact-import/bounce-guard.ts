/**
 * Mailbox protection for imported lists, whose addresses nobody verified:
 * sending pauses once more than 5% of a campaign's sent emails bounced, after
 * at least 20 sends (fewer is too small a sample to judge a list). Pure.
 *
 * Bounces are known only after Stage 8 polls the mailbox (every 10 minutes),
 * so the rate is the bounces seen so far, checked before every send and again
 * whenever a bounce is recorded.
 *
 * Recovery: the user removes the bounced addresses and resumes. The rule then
 * counts only emails sent after the resume (`since`), so the same 5% over at
 * least 20 sends applies to the cleaned list; a list that keeps bouncing
 * pauses again.
 */

export const BOUNCE_GUARD_MIN_SENDS = 20
export const BOUNCE_GUARD_MAX_RATE = 0.05

export const PAUSED_BOUNCE_RATE = "paused_bounce_rate"

export function shouldPauseForBounces({ sent, bounced }: Pick<DeliveryCounts, "sent" | "bounced">): boolean {
  if (sent < BOUNCE_GUARD_MIN_SENDS) return false
  return bounced / sent > BOUNCE_GUARD_MAX_RATE
}

export interface GuardDraft {
  id: string
  contactId: string
  status: string
  sentAt: Date | string | null
  hasBounced: boolean
}

/**
 * The one count of what left the mailbox, used by the process card, the
 * bounce-pause panel and the pause check alike:
 * - sent: every email that left the mailbox, bounced ones included (a bounce
 *   is a sent email the recipient's server returned);
 * - delivered: sent minus bounced;
 * - bounced, and bounceRate = bounced / sent (0 when nothing was sent).
 */
export interface DeliveryCounts {
  sent: number
  delivered: number
  bounced: number
  bounceRate: number
}

export type DeliveryDraft = Pick<GuardDraft, "status" | "sentAt" | "hasBounced">

const sentTime = (d: Pick<GuardDraft, "sentAt">) => (d.sentAt == null ? null : new Date(d.sentAt).getTime())

/** Counts only emails sent at or after `since` when given (the pause's baseline after a resume). */
export function deliveryCounts(drafts: DeliveryDraft[], since: Date | string | null = null): DeliveryCounts {
  const from = since == null ? null : new Date(since).getTime()
  let sent = 0
  let bounced = 0
  for (const d of drafts) {
    const at = sentTime(d)
    const wasSent = at != null || d.status === "sent"
    if (!wasSent || (from != null && (at == null || at < from))) continue
    sent++
    if (d.hasBounced) bounced++
  }
  return { sent, delivered: sent - bounced, bounced, bounceRate: sent === 0 ? 0 : bounced / sent }
}

/**
 * What "remove bounced addresses and resume" changes: the people whose email
 * bounced, any of their drafts still waiting to go (rejected so they never
 * send), and where sending picks up from the approved drafts that remain.
 */
export function planBounceRecovery(drafts: GuardDraft[]): {
  bouncedContactIds: string[]
  draftIdsToReject: string[]
  approvedRemaining: number
  next: "send" | "review" | "done"
} {
  const bounced = new Set(drafts.filter((d) => d.hasBounced).map((d) => d.contactId))
  const pending = (d: GuardDraft) => d.status === "draft" || d.status === "approved"
  const draftIdsToReject = drafts.filter((d) => bounced.has(d.contactId) && pending(d)).map((d) => d.id)
  const remaining = drafts.filter((d) => !bounced.has(d.contactId))
  const approvedRemaining = remaining.filter((d) => d.status === "approved").length
  const next = approvedRemaining > 0 ? "send" : remaining.some((d) => d.status === "draft") ? "review" : "done"
  return { bouncedContactIds: [...bounced], draftIdsToReject, approvedRemaining, next }
}

/**
 * Mailbox protection for imported lists, whose addresses nobody verified:
 * sending pauses once more than 5% of a campaign's sent emails bounced, after
 * at least 20 sends (fewer is too small a sample to judge a list). Pure.
 *
 * Bounces are known only after Stage 8 polls the mailbox (every 10 minutes),
 * so the rate is the bounces seen so far, checked before every send and again
 * whenever a bounce is recorded.
 */

export const BOUNCE_GUARD_MIN_SENDS = 20
export const BOUNCE_GUARD_MAX_RATE = 0.05

export const PAUSED_BOUNCE_RATE = "paused_bounce_rate"

export function shouldPauseForBounces({ sent, bounced }: { sent: number; bounced: number }): boolean {
  if (sent < BOUNCE_GUARD_MIN_SENDS) return false
  return bounced / sent > BOUNCE_GUARD_MAX_RATE
}

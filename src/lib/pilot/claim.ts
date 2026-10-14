import "server-only"
import { and, eq, isNull, lt, or } from "drizzle-orm"
import { db } from "@/utils/db"
import { pilotInvite } from "@/db/schema"
import { activateOrganizationPlan } from "@/lib/billing-plan"
import { addTopupCredits } from "@/lib/gtm-ai-credits"
import { CLAIM_LEASE_MS, normalizeInviteEmail, type GrantablePlan } from "./invites"

export type ClaimOutcome =
  /** No invited row for this email (none, revoked, or bound to another org). */
  | "no_invite"
  /** This call applied the invite (or finished a half-applied one). */
  | "claimed"
  /** Already fully applied earlier. */
  | "already_claimed"
  /** Another request holds the claim lease right now and will finish it. */
  | "in_progress"

export interface ClaimInput {
  userId: string
  email: string
  organizationId: string
}

/**
 * Applies a pilot invite to the organization, exactly once.
 *
 * Neon's HTTP driver has no interactive transactions, so this is built from
 * steps that are each safe to repeat:
 * 1. Take a lease with one conditional UPDATE (status still `invited`, not
 *    bound to another org, no live lease). Concurrent submits race on that
 *    row and only one wins; the others return `in_progress` and grant nothing.
 * 2. Activate the plan (the Dodo activation path) unless `planAppliedAt` is set.
 * 3. Grant the extra credits through the shared grant path with the idempotency
 *    key `pilot_invite:<id>`, so even a repeat after a crash adds them once.
 * 4. Mark the invite `claimed` and drop the lease.
 * If a step throws, the lease is released so a retry (onboarding resubmit, or
 * the access check when launching a campaign) finishes the remaining steps.
 */
export async function claimPilotInvite(input: ClaimInput): Promise<ClaimOutcome> {
  const email = normalizeInviteEmail(input.email)
  const leaseCutoff = new Date(Date.now() - CLAIM_LEASE_MS)

  const [invite] = await db
    .update(pilotInvite)
    .set({
      claimLockedAt: new Date(),
      claimedUserId: input.userId,
      claimedOrgId: input.organizationId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(pilotInvite.email, email),
        eq(pilotInvite.status, "invited"),
        or(isNull(pilotInvite.claimedOrgId), eq(pilotInvite.claimedOrgId, input.organizationId)),
        or(isNull(pilotInvite.claimLockedAt), lt(pilotInvite.claimLockedAt, leaseCutoff))
      )
    )
    .returning()

  if (!invite) return describeUnclaimable(email, input.organizationId)

  try {
    if (!invite.planAppliedAt) {
      await activateOrganizationPlan(input.organizationId, invite.plan as GrantablePlan)
      await db
        .update(pilotInvite)
        .set({ planAppliedAt: new Date() })
        .where(eq(pilotInvite.id, invite.id))
    }

    if (invite.credits > 0 && !invite.creditsGrantedAt) {
      await addTopupCredits(
        input.organizationId,
        invite.credits,
        `Pilot access: ${invite.credits} credits granted with the ${invite.plan} plan${
          invite.note ? ` (${invite.note})` : ""
        }`,
        {
          type: "manual_grant",
          createdByUserId: invite.createdByUserId,
          idempotencyKey: `pilot_invite:${invite.id}`,
        }
      )
      await db
        .update(pilotInvite)
        .set({ creditsGrantedAt: new Date() })
        .where(eq(pilotInvite.id, invite.id))
    }

    await db
      .update(pilotInvite)
      .set({ status: "claimed", claimedAt: new Date(), claimLockedAt: null, updatedAt: new Date() })
      .where(eq(pilotInvite.id, invite.id))
    return "claimed"
  } catch (err) {
    await db
      .update(pilotInvite)
      .set({ claimLockedAt: null })
      .where(eq(pilotInvite.id, invite.id))
      .catch(() => {})
    throw err
  }
}

async function describeUnclaimable(email: string, organizationId: string): Promise<ClaimOutcome> {
  const [row] = await db
    .select({ status: pilotInvite.status, claimedOrgId: pilotInvite.claimedOrgId })
    .from(pilotInvite)
    .where(eq(pilotInvite.email, email))
  if (!row || row.claimedOrgId !== organizationId) return "no_invite"
  if (row.status === "claimed") return "already_claimed"
  if (row.status === "invited") return "in_progress"
  return "no_invite"
}

/**
 * Finishes a claim that started for this organization but stopped halfway
 * (its lease has expired). Used by the campaign access check, so a customer
 * whose onboarding claim failed still gets their plan without resubmitting.
 */
export async function resumePilotClaimForOrganization(organizationId: string) {
  const [pending] = await db
    .select()
    .from(pilotInvite)
    .where(and(eq(pilotInvite.claimedOrgId, organizationId), eq(pilotInvite.status, "invited")))
    .limit(1)
  if (!pending?.claimedUserId) return "no_invite" as const
  return claimPilotInvite({
    userId: pending.claimedUserId,
    email: pending.email,
    organizationId,
  })
}

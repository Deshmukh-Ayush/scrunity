import "server-only"
import { eq } from "drizzle-orm"
import { db } from "@/utils/db"
import { organization, user } from "@/db/schema"
import { getMaxActiveCampaigns } from "@/config/billing"
import { onboardingOrganizationId } from "@/lib/onboarding-id"
import { claimPilotInvite, resumePilotClaimForOrganization } from "./claim"

export function supportEmail(): string {
  return process.env.SUPPORT_EMAIL || "support@scrunity.com"
}

/** Shown wherever an organization without a plan tries to start a campaign. */
export function noAccessMessage(): string {
  return `Your account doesn't have access yet. Contact ${supportEmail()}.`
}

async function organizationPlan(organizationId: string) {
  const [org] = await db
    .select({ plan: organization.plan })
    .from(organization)
    .where(eq(organization.id, organizationId))
  return org?.plan ?? "free"
}

/**
 * Whether the organization's plan allows campaigns at all. An organization
 * without one first gets any pilot invite applied: a claim that stopped
 * halfway is finished, and an invite added after the user onboarded is
 * claimed for their own onboarding org. Then the plan is read again.
 */
export async function resolveCampaignAccess(organizationId: string, userId: string) {
  let plan = await organizationPlan(organizationId)
  if (getMaxActiveCampaigns(plan) !== 0) return { hasAccess: true, plan }

  let outcome = await resumePilotClaimForOrganization(organizationId)
  if (outcome === "no_invite" && organizationId === onboardingOrganizationId(userId)) {
    const [owner] = await db
      .select({ email: user.email, emailVerified: user.emailVerified })
      .from(user)
      .where(eq(user.id, userId))
    if (owner?.emailVerified) {
      outcome = await claimPilotInvite({ userId, email: owner.email, organizationId })
    }
  }
  if (outcome === "claimed") plan = await organizationPlan(organizationId)
  return { hasAccess: getMaxActiveCampaigns(plan) !== 0, plan }
}

import "server-only"
import { eq } from "drizzle-orm"
import { db } from "@/utils/db"
import { organization } from "@/db/schema"
import { activateOrganizationPlan } from "@/lib/billing-plan"
import { addTopupCredits } from "@/lib/gtm-ai-credits"
import type { GrantablePlan } from "./invites"

export const MAX_MANUAL_GRANT = 100_000

async function organizationExists(organizationId: string) {
  const [row] = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.id, organizationId))
  return Boolean(row)
}

/**
 * Adds credits to an organization through the same grant path as a Dodo
 * top-up, recorded as a `manual_grant` ledger row with the admin's user id and
 * the reason in its description (shown in the billing page's ledger).
 * `requestId` (sent by the admin form) makes a double-submitted form grant once.
 */
export async function grantManualCredits(input: {
  organizationId: string
  amount: number
  reason: string
  adminUserId: string
  adminEmail: string
  requestId: string
}) {
  if (!(await organizationExists(input.organizationId))) return { status: "not_found" as const }
  const result = await addTopupCredits(
    input.organizationId,
    input.amount,
    `Manual grant of ${input.amount} credits by ${input.adminEmail}: ${input.reason}`,
    {
      type: "manual_grant",
      createdByUserId: input.adminUserId,
      idempotencyKey: `admin_grant:${input.requestId}`,
    }
  )
  return { status: result.applied ? ("granted" as const) : ("duplicate" as const), ...result }
}

/** Sets the plan exactly as a Dodo subscription activation does (see activateOrganizationPlan). */
export async function setOrganizationPlan(organizationId: string, plan: GrantablePlan) {
  if (!(await organizationExists(organizationId))) return { status: "not_found" as const }
  const period = await activateOrganizationPlan(organizationId, plan)
  return { status: "updated" as const, creditsRemaining: period.creditsRemaining }
}

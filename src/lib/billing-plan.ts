import "server-only"
import { eq } from "drizzle-orm"
import { db } from "@/utils/db"
import { organization } from "@/db/schema"
import { resetCreditPeriod } from "@/lib/gtm-ai-credits"

type PlanValue = typeof organization.$inferSelect.plan

export interface ActivatePlanOptions {
  /** End of the paid period; defaults to 30 days from now. */
  periodEnd?: Date
  /** Dodo identifiers, written only when given (the Dodo webhook passes them). */
  dodoCustomerId?: string | null
  dodoSubscriptionId?: string | null
}

/**
 * Puts an organization on a plan, exactly as a Dodo `subscription.active` /
 * `subscription.renewed` event does. It changes:
 * - `organization.plan`, `subscriptionStatus = "active"` and `currentPeriodEnd`
 *   (plus the Dodo customer/subscription ids when given). Plan limits such as
 *   active campaigns and seats are read from `organization.plan`.
 * - the credit balance: a new `gtm_ai_credit_period` at the plan's allotment
 *   with a `period_reset` ledger row. No rollover: the previous period's
 *   remaining credits, including earlier top-ups or grants, are not carried over.
 *
 * Used by the Dodo webhook (lib/dodo-webhook.ts), the platform admin's
 * "set plan" action and pilot invite claims.
 */
export async function activateOrganizationPlan(
  organizationId: string,
  plan: PlanValue,
  options: ActivatePlanOptions = {}
) {
  const periodEnd = options.periodEnd ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  await db
    .update(organization)
    .set({
      plan,
      subscriptionStatus: "active",
      currentPeriodEnd: periodEnd,
      ...(options.dodoCustomerId ? { dodoCustomerId: options.dodoCustomerId } : {}),
      ...(options.dodoSubscriptionId ? { dodoSubscriptionId: options.dodoSubscriptionId } : {}),
      updatedAt: new Date(),
    })
    .where(eq(organization.id, organizationId))
  // On activation or renewal: reset the balance to the plan allotment, no rollover.
  return resetCreditPeriod(organizationId, plan, periodEnd)
}

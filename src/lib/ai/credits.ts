import crypto from "crypto"
import { and, desc, eq, gte, lte, sql } from "drizzle-orm"
import {
  ENFORCE_CREDIT_LIMITS,
  getPlanCreditAllotments,
} from "@/config/credits"
import { organization, organizationCreditPeriod, usageEvent } from "@/db/schema"
import { db } from "@/utils/db"

export type CreditType = "ai" | "search"

function billingPeriod(
  createdAt: Date,
  currentPeriodEnd: Date | null,
  now: Date
) {
  const duration = 30 * 24 * 60 * 60 * 1000
  if (currentPeriodEnd && now <= currentPeriodEnd) {
    return {
      periodStart: new Date(currentPeriodEnd.getTime() - duration),
      periodEnd: currentPeriodEnd,
    }
  }
  const elapsed = Math.max(0, now.getTime() - createdAt.getTime())
  const periodStart = new Date(
    createdAt.getTime() + Math.floor(elapsed / duration) * duration
  )
  return { periodStart, periodEnd: new Date(periodStart.getTime() + duration) }
}

export async function getOrCreateActiveCreditPeriod(organizationId: string) {
  const now = new Date()
  const [org] = await db
    .select({
      plan: organization.plan,
      createdAt: organization.createdAt,
      currentPeriodEnd: organization.currentPeriodEnd,
    })
    .from(organization)
    .where(eq(organization.id, organizationId))
  if (!org) throw new Error(`Organization ${organizationId} not found`)

  const [active] = await db
    .select()
    .from(organizationCreditPeriod)
    .where(
      and(
        eq(organizationCreditPeriod.organizationId, organizationId),
        lte(organizationCreditPeriod.periodStart, now),
        gte(organizationCreditPeriod.periodEnd, now)
      )
    )
    .orderBy(desc(organizationCreditPeriod.createdAt))
    .limit(1)
  if (active) return active

  const allocation = getPlanCreditAllotments(org.plan)
  const period = billingPeriod(org.createdAt, org.currentPeriodEnd, now)
  const [created] = await db
    .insert(organizationCreditPeriod)
    .values({
      id: crypto.randomUUID(),
      organizationId,
      ...period,
      aiCreditsAllotted: allocation.aiCredits,
      searchCreditsAllotted: allocation.searchCredits,
    })
    .returning()
  return created
}

export async function checkCreditAllowance(
  organizationId: string,
  type: CreditType,
  units = 1
) {
  const period = await getOrCreateActiveCreditPeriod(organizationId)
  const used =
    type === "search" ? period.searchCreditsUsed : period.aiCreditsUsed
  const allotted =
    type === "search" ? period.searchCreditsAllotted : period.aiCreditsAllotted
  return { allowed: !ENFORCE_CREDIT_LIMITS || used + units <= allotted, period }
}

/** Records provider use in the same pooled usage ledger used for external search. */
export async function recordCreditUsage({
  organizationId,
  toolName,
  metadata,
  units = 1,
}: {
  organizationId: string
  toolName: string
  metadata?: Record<string, unknown>
  units?: number
}) {
  const period = await getOrCreateActiveCreditPeriod(organizationId)
  const now = new Date()
  await db
    .update(organizationCreditPeriod)
    .set({
      aiCreditsUsed: sql`${organizationCreditPeriod.aiCreditsUsed} + ${units}`,
      searchCreditsUsed: sql`${organizationCreditPeriod.searchCreditsUsed} + ${units}`,
      updatedAt: now,
    })
    .where(eq(organizationCreditPeriod.id, period.id))
  await db.insert(usageEvent).values({
    id: crypto.randomUUID(),
    organizationId,
    type: "web_search",
    toolName,
    metadata: metadata ?? null,
    createdAt: now,
  })
}

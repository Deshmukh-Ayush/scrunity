import "server-only"

import { desc, eq, sql } from "drizzle-orm"
import { db } from "@/utils/db"
import { gtmAiCreditTransaction, organization, pilotInvite, user } from "@/db/schema"

/** Every pilot invite, newest first. Backs the platform admin page. */
export function listPilotInvites() {
  return db
    .select({
      id: pilotInvite.id,
      email: pilotInvite.email,
      plan: pilotInvite.plan,
      credits: pilotInvite.credits,
      note: pilotInvite.note,
      status: pilotInvite.status,
      claimedOrgId: pilotInvite.claimedOrgId,
      claimedAt: pilotInvite.claimedAt,
      createdAt: pilotInvite.createdAt,
    })
    .from(pilotInvite)
    .orderBy(desc(pilotInvite.createdAt))
}

export type AdminPilotInvite = Awaited<ReturnType<typeof listPilotInvites>>[number]

/**
 * Every organization with its plan and current credit balance. Read-only: the
 * balance is the active credit period's remaining credits, or 0 when the org
 * has no active period yet (none is created here).
 */
export function listOrganizationsForAdmin() {
  return db
    .select({
      id: organization.id,
      name: organization.name,
      plan: organization.plan,
      subscriptionStatus: organization.subscriptionStatus,
      createdAt: organization.createdAt,
      ownerEmail: sql<string | null>`(
        SELECT u.email FROM member m JOIN ${user} u ON u.id = m.user_id
        WHERE m.organization_id = "organization"."id" AND m.role = 'owner'
        ORDER BY m.created_at LIMIT 1)`,
      creditsRemaining: sql<number>`coalesce((
        SELECT p.credits_remaining FROM gtm_ai_credit_period p
        WHERE p.organization_id = "organization"."id"
          AND p.period_start <= now() AND p.period_end >= now()
        ORDER BY p.period_start DESC LIMIT 1), 0)::int`,
    })
    .from(organization)
    .orderBy(desc(organization.createdAt))
}

export type AdminOrganization = Awaited<ReturnType<typeof listOrganizationsForAdmin>>[number]

/** The 25 most recent manual grants across all organizations. */
export function listRecentManualGrants() {
  return db
    .select({
      id: gtmAiCreditTransaction.id,
      organizationId: gtmAiCreditTransaction.organizationId,
      organizationName: organization.name,
      amount: gtmAiCreditTransaction.amount,
      description: gtmAiCreditTransaction.description,
      createdByUserId: gtmAiCreditTransaction.createdByUserId,
      createdAt: gtmAiCreditTransaction.createdAt,
    })
    .from(gtmAiCreditTransaction)
    .innerJoin(organization, eq(organization.id, gtmAiCreditTransaction.organizationId))
    .where(eq(gtmAiCreditTransaction.type, "manual_grant"))
    .orderBy(desc(gtmAiCreditTransaction.createdAt))
    .limit(25)
}

export type AdminManualGrant = Awaited<ReturnType<typeof listRecentManualGrants>>[number]

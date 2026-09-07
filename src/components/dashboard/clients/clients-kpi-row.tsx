import { headers } from "next/headers"
import { db } from "@/utils/db"
import {
  projectMember,
  invitation,
  proposal,
  contract,
  invoice,
  organization,
} from "@/db/schema"
import { inArray, eq, and } from "drizzle-orm"
import { getTenantContext } from "@/lib/tenant-context"
import { getCachedOrgProjects } from "@/utils/cached-org-queries"
import { convertAndAggregate, getUsdToInrRate } from "@/lib/currency"
import { ClientsKpiRowClient, ClientsKpiData } from "./clients-kpi-row-client"

export async function ClientsKpiRow() {
  const reqHeaders = await headers()
  const ctx = await getTenantContext(reqHeaders)

  if (!ctx.organizationId) {
    return null
  }

  const [org] = await db
    .select({ globalCurrency: organization.globalCurrency })
    .from(organization)
    .where(eq(organization.id, ctx.organizationId))
  const targetCurrency = (org?.globalCurrency as "USD" | "INR") || "USD"

  const orgProjects = await getCachedOrgProjects(ctx.organizationId)
  const projectIds = orgProjects.map((p) => p.id)

  if (projectIds.length === 0) {
    const emptyData: ClientsKpiData = {
      activeClientsCount: 0,
      invitedClientsCount: 0,
      avgContractValue: 0,
      totalWonRevenue: 0,
      currency: targetCurrency,
      pendingActionCount: 0,
      pendingContractsCount: 0,
      pendingInvoicesCount: 0,
      proposalWinRate: 0,
      acceptedProposalsCount: 0,
      totalClosedProposalsCount: 0,
    }
    return <ClientsKpiRowClient data={emptyData} />
  }

  const [
    clientMembers,
    pendingInvites,
    proposalsList,
    pendingContracts,
    pendingInvoices,
    usdToInrRate,
  ] = await Promise.all([
    db
      .select({
        userId: projectMember.userId,
      })
      .from(projectMember)
      .where(
        and(
          inArray(projectMember.projectId, projectIds),
          eq(projectMember.role, "client")
        )
      ),
    db
      .select({ id: invitation.id })
      .from(invitation)
      .where(
        and(
          eq(invitation.organizationId, ctx.organizationId),
          eq(invitation.status, "pending")
        )
      ),
    db
      .select({
        projectId: proposal.projectId,
        price: proposal.price,
        currency: proposal.currency,
        status: proposal.status,
      })
      .from(proposal)
      .where(inArray(proposal.projectId, projectIds)),
    db
      .select({ id: contract.id })
      .from(contract)
      .where(
        and(
          inArray(contract.projectId, projectIds),
          inArray(contract.status, [
            "draft",
            "sent",
            "partially_signed",
            "pending_signature",
          ])
        )
      ),
    db
      .select({ id: invoice.id })
      .from(invoice)
      .where(
        and(
          inArray(invoice.projectId, projectIds),
          inArray(invoice.status, [
            "sent",
            "viewed",
            "payment_submitted",
            "overdue",
          ])
        )
      ),
    getUsdToInrRate(),
  ])

  const distinctClientIds = new Set(clientMembers.map((m) => m.userId))
  const activeClientsCount = distinctClientIds.size
  const invitedClientsCount = pendingInvites.length

  const acceptedItems = proposalsList
    .filter((p) => p.status === "accepted")
    .map((p) => ({ amount: p.price, currency: p.currency }))

  const { total: totalWonRevenue } = convertAndAggregate(
    acceptedItems,
    targetCurrency,
    usdToInrRate
  )

  const avgContractValue =
    activeClientsCount > 0 ? Math.round(totalWonRevenue / activeClientsCount) : 0

  const pendingContractsCount = pendingContracts.length
  const pendingInvoicesCount = pendingInvoices.length
  const pendingActionCount = pendingContractsCount + pendingInvoicesCount

  const acceptedProposalsCount = acceptedItems.length
  const declinedProposalsCount = proposalsList.filter(
    (p) => p.status === "declined"
  ).length
  const totalClosedProposalsCount =
    acceptedProposalsCount + declinedProposalsCount
  const proposalWinRate =
    totalClosedProposalsCount > 0
      ? Math.round((acceptedProposalsCount / totalClosedProposalsCount) * 100)
      : 0

  const data: ClientsKpiData = {
    activeClientsCount,
    invitedClientsCount,
    avgContractValue,
    totalWonRevenue,
    currency: targetCurrency,
    pendingActionCount,
    pendingContractsCount,
    pendingInvoicesCount,
    proposalWinRate,
    acceptedProposalsCount,
    totalClosedProposalsCount,
  }

  return <ClientsKpiRowClient data={data} />
}

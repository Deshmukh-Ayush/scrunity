import { headers } from "next/headers"
import { db } from "@/utils/db"
import { proposal, deliverable, organization } from "@/db/schema"
import { inArray, eq, and, gte } from "drizzle-orm"
import { getTenantContext } from "@/lib/tenant-context"
import { getCachedOrgProjects } from "@/utils/cached-org-queries"
import { subDays, subMonths, startOfYear } from "date-fns"
import { AnalyticsKpiRowClient, AnalyticsKpiData } from "./analytics-kpi-row-client"
import { convertAndAggregate, getUsdToInrRate } from "@/lib/currency"

export async function AnalyticsKpiRow({ range = "6m" }: { range?: string }) {
  const reqHeaders = await headers()
  const ctx = await getTenantContext(reqHeaders)

  if (!ctx.organizationId) {
    return null
  }

  // Fetch workspace project IDs first (cached across sibling components)
  const orgProjects = await getCachedOrgProjects(ctx.organizationId)

  const [org] = await db
    .select({ globalCurrency: organization.globalCurrency })
    .from(organization)
    .where(eq(organization.id, ctx.organizationId))
  const targetCurrency = (org?.globalCurrency as "USD" | "INR") || "USD"

  const projectIds = orgProjects.map((p) => p.id)

  if (projectIds.length === 0) {
    const emptyData: AnalyticsKpiData = {
      wonRevenue: 0,
      pipelineValue: 0,
      currency: targetCurrency,
      winRate: 0,
      acceptedProposalsCount: 0,
      totalClosedProposalsCount: 0,
      deliverableApprovalRate: 0,
      approvedDeliverablesCount: 0,
      totalDeliverablesCount: 0,
    }
    return <AnalyticsKpiRowClient data={emptyData} />
  }

  const today = new Date()
  let startDate: Date | null = null

  if (range === "30d") startDate = subDays(today, 30)
  else if (range === "90d") startDate = subDays(today, 90)
  else if (range === "ytd") startDate = startOfYear(today)
  else if (range === "6m") startDate = subMonths(today, 5)

  const proposalWhere =
    startDate !== null
      ? and(inArray(proposal.projectId, projectIds), gte(proposal.createdAt, startDate))
      : inArray(proposal.projectId, projectIds)

  // Execute queries and live FX rate fetch concurrently (Vercel async-parallel rule)
  const [proposalsList, deliverablesList, usdToInrRate] = await Promise.all([
    db
      .select({
        price: proposal.price,
        currency: proposal.currency,
        status: proposal.status,
      })
      .from(proposal)
      .where(proposalWhere),
    db
      .select({
        status: deliverable.status,
      })
      .from(deliverable)
      .where(inArray(deliverable.projectId, projectIds)),
    getUsdToInrRate(),
  ])

  const acceptedItems = proposalsList
    .filter((p) => p.status === "accepted")
    .map((p) => ({ amount: p.price, currency: p.currency }))
  const { total: wonRevenue } = convertAndAggregate(acceptedItems, targetCurrency, usdToInrRate)

  const sentItems = proposalsList
    .filter((p) => p.status === "sent")
    .map((p) => ({ amount: p.price, currency: p.currency }))
  const { total: pipelineValue } = convertAndAggregate(sentItems, targetCurrency, usdToInrRate)

  let acceptedProposalsCount = 0
  let closedProposalsCount = 0

  proposalsList.forEach((p) => {
    if (p.status === "accepted") {
      acceptedProposalsCount++
      closedProposalsCount++
    } else if (p.status === "declined") {
      closedProposalsCount++
    }
  })

  const winRate =
    closedProposalsCount > 0
      ? Math.round((acceptedProposalsCount / closedProposalsCount) * 100)
      : 0

  // Single-pass calculation for deliverables
  let approvedDeliverablesCount = 0
  const totalDeliverablesCount = deliverablesList.length

  deliverablesList.forEach((d) => {
    if (d.status === "approved") {
      approvedDeliverablesCount++
    }
  })

  const deliverableApprovalRate =
    totalDeliverablesCount > 0
      ? Math.round((approvedDeliverablesCount / totalDeliverablesCount) * 100)
      : 0

  const kpiData: AnalyticsKpiData = {
    wonRevenue,
    pipelineValue,
    currency: targetCurrency,
    winRate,
    acceptedProposalsCount,
    totalClosedProposalsCount: closedProposalsCount,
    deliverableApprovalRate,
    approvedDeliverablesCount,
    totalDeliverablesCount,
  }

  return <AnalyticsKpiRowClient data={kpiData} />
}

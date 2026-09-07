import { headers } from "next/headers"
import { db } from "@/utils/db"
import { proposal, contract } from "@/db/schema"
import { inArray, gte, and } from "drizzle-orm"
import { getTenantContext } from "@/lib/tenant-context"
import { getCachedOrgProjects } from "@/utils/cached-org-queries"
import { format, subMonths, startOfMonth, isSameMonth } from "date-fns"
import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"
import type { MonthlyClientConversionPoint } from "./clients-hero-chart-client"

const DynamicClientsHeroChartUI = dynamic(
  () => import("./clients-hero-chart-client").then((mod) => mod.ClientsHeroChartUI),
  {
    loading: () => <Skeleton className="h-[380px] w-full rounded-2xl" />,
  }
)

export async function ClientsHeroChart({ range = "6m" }: { range?: string }) {
  const reqHeaders = await headers()
  const ctx = await getTenantContext(reqHeaders)

  if (!ctx.organizationId) {
    return null
  }

  const today = new Date()

  let monthCount = 6
  let periodLabel = "Last 6 Months"

  if (range === "90d") {
    monthCount = 3
    periodLabel = "Last 90 Days"
  } else if (range === "1y") {
    monthCount = 12
    periodLabel = "Last 1 Year"
  } else if (range === "all") {
    monthCount = 12
    periodLabel = "All Time"
  }

  const startDate = startOfMonth(subMonths(today, monthCount - 1))

  const orgProjects = await getCachedOrgProjects(ctx.organizationId)
  const projectIds = orgProjects.map((p) => p.id)

  if (projectIds.length === 0) {
    const emptyChart: MonthlyClientConversionPoint[] = Array.from({ length: monthCount }, (_, i) => ({
      month: format(subMonths(today, monthCount - 1 - i), "MMM yyyy"),
      proposalsSent: 0,
      clientsClosed: 0,
    }))
    return (
      <DynamicClientsHeroChartUI
        conversionData={emptyChart}
        totalProposalsSent={0}
        totalClientsClosed={0}
        avgConversionRate={0}
        periodLabel={periodLabel}
      />
    )
  }

  const [proposalsList, contractsList] = await Promise.all([
    db
      .select({
        status: proposal.status,
        createdAt: proposal.createdAt,
      })
      .from(proposal)
      .where(and(inArray(proposal.projectId, projectIds), gte(proposal.createdAt, startDate))),
    db
      .select({
        status: contract.status,
        createdAt: contract.createdAt,
      })
      .from(contract)
      .where(and(inArray(contract.projectId, projectIds), gte(contract.createdAt, startDate))),
  ])

  const months = Array.from({ length: monthCount }, (_, i) => subMonths(today, monthCount - 1 - i))

  let totalProposalsSent = 0
  let totalClientsClosed = 0

  const conversionData: MonthlyClientConversionPoint[] = months.map((m) => {
    const monthLabel = format(m, "MMM yyyy")
    let proposalsSent = 0
    let clientsClosed = 0

    proposalsList.forEach((p) => {
      if (isSameMonth(new Date(p.createdAt), m)) {
        proposalsSent++
        if (p.status === "accepted") {
          clientsClosed++
        }
      }
    })

    contractsList.forEach((c) => {
      if (isSameMonth(new Date(c.createdAt), m)) {
        if (c.status === "signed" || c.status === "fully_signed") {
          clientsClosed++
        }
      }
    })

    totalProposalsSent += proposalsSent
    totalClientsClosed += clientsClosed

    return {
      month: monthLabel,
      proposalsSent,
      clientsClosed,
    }
  })

  const avgConversionRate = totalProposalsSent > 0 ? Math.round((totalClientsClosed / totalProposalsSent) * 100) : 0

  return (
    <DynamicClientsHeroChartUI
      conversionData={conversionData}
      totalProposalsSent={totalProposalsSent}
      totalClientsClosed={totalClientsClosed}
      avgConversionRate={avgConversionRate}
      periodLabel={periodLabel}
    />
  )
}

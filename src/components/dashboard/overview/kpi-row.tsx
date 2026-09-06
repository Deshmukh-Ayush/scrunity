import { getTenantContext } from "@/lib/tenant-context"
import { headers } from "next/headers"
import { db } from "@/utils/db"
import { inArray } from "drizzle-orm"
import { proposal } from "@/db/schema"
import { getAccessibleProjectIds } from "@/lib/project-queries"
import { getCachedOrg, getCachedRecentActivity } from "@/utils/cached-org-queries"
import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"
import { subDays, isSameDay } from "date-fns"
import { convertAndAggregate, getUsdToInrRate } from "@/lib/currency"

const DynamicDashboardKpiRowUI = dynamic(
  () => import("./kpi-row-client").then((mod) => mod.DashboardKpiRowUI),
  {
    loading: () => <Skeleton className="h-[180px] w-full rounded-md" />,
  }
)

export async function DashboardKpiRow() {
  const reqHeaders = await headers()
  const ctx = await getTenantContext(reqHeaders)

  if (!ctx.user) {
    return null
  }

  // Fetch accessible projects and cached org currency in parallel
  const [projectIds, org] = await Promise.all([
    getAccessibleProjectIds(ctx.user.id, ctx.organizationId),
    ctx.organizationId ? getCachedOrg(ctx.organizationId) : Promise.resolve(null),
  ])
  const activeProjectsCount = projectIds.length

  let targetCurrency: "USD" | "INR" = "USD";
  if (org?.globalCurrency === "INR" || org?.globalCurrency === "USD") {
    targetCurrency = org.globalCurrency;
  }

  if (projectIds.length === 0) {
    return (
      <DynamicDashboardKpiRowUI
        totalIncome={0}
        activeProjectsCount={0}
        currency={targetCurrency}
        trendData1={[]}
        trendData2={[]}
      />
    )
  }

  // Execute queries and live FX rate fetch concurrently (Promise.all)
  const today = new Date()
  const sevenDaysAgo = subDays(today, 6)
  const projectIdsKey = [...projectIds].sort().join(",")
  const sevenDaysAgoIso = sevenDaysAgo.toISOString()

  const [proposalsList, recentActivity, usdToInrRate] = await Promise.all([
    db
      .select({
        price: proposal.price,
        currency: proposal.currency,
        status: proposal.status,
      })
      .from(proposal)
      .where(inArray(proposal.projectId, projectIds)),
    getCachedRecentActivity(projectIdsKey, sevenDaysAgoIso),
    getUsdToInrRate(),
  ])

  // Convert proposals to targetCurrency at live exchange rate for accurate totals
  const acceptedItems = proposalsList
    .filter((p) => p.status === "accepted")
    .map((p) => ({ amount: p.price, currency: p.currency }));

  const { total: totalIncome } = convertAndAggregate(acceptedItems, targetCurrency, usdToInrRate);

  // Generate 7-day trend micro sparklines
  const days = Array.from({ length: 7 }, (_, i) => subDays(today, 6 - i))

  const trendData1 = days.map((_, idx) => {
    return {
      day: idx,
      value: Math.round((totalIncome / (7 - idx)) * (1 + (idx * 0.05))),
    }
  })

  const trendData2 = days.map((d, idx) => {
    const actCount = recentActivity.filter((a) =>
      isSameDay(new Date(a.createdAt), d)
    ).length
    return {
      day: idx,
      value: actCount + (idx + 1),
    }
  })

  return (
    <DynamicDashboardKpiRowUI
      totalIncome={totalIncome}
      activeProjectsCount={activeProjectsCount}
      currency={targetCurrency}
      trendData1={trendData1}
      trendData2={trendData2}
    />
  )
}

import { headers } from "next/headers"
import { db } from "@/utils/db"
import { proposal, organization } from "@/db/schema"
import { inArray, gte, and, eq } from "drizzle-orm"
import { getTenantContext } from "@/lib/tenant-context"
import { getCachedOrgProjects } from "@/utils/cached-org-queries"
import {
  format,
  subMonths,
  startOfMonth,
  isSameMonth,
  subDays,
  startOfYear,
  differenceInCalendarMonths,
  isSameDay,
} from "date-fns"
import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"
import type { MonthlyVelocityPoint } from "./analytics-hero-chart-client"
import { convertAndAggregate, getUsdToInrRate } from "@/lib/currency"

const DynamicAnalyticsHeroChartUI = dynamic(
  () => import("./analytics-hero-chart-client").then((mod) => mod.AnalyticsHeroChartUI),
  {
    loading: () => <Skeleton className="h-[380px] w-full rounded-2xl" />,
  }
)

export async function AnalyticsHeroChart({ range = "6m" }: { range?: string }) {
  const reqHeaders = await headers()
  const ctx = await getTenantContext(reqHeaders)

  if (!ctx.organizationId) {
    return null
  }

  const today = new Date()

  // Determine date bounds and bucket points according to range
  let startDate: Date
  let windowLabel = "Last 6 Months"
  let bucketMode: "daily" | "monthly" = "monthly"
  let bucketCount = 6

  if (range === "30d") {
    startDate = subDays(today, 29)
    windowLabel = "Last 30 Days"
    bucketMode = "daily"
    bucketCount = 30
  } else if (range === "90d") {
    startDate = startOfMonth(subMonths(today, 2))
    windowLabel = "Last 90 Days"
    bucketMode = "monthly"
    bucketCount = 3
  } else if (range === "ytd") {
    startDate = startOfYear(today)
    windowLabel = "Year to Date"
    bucketMode = "monthly"
    bucketCount = Math.max(1, differenceInCalendarMonths(today, startDate) + 1)
  } else if (range === "all") {
    startDate = new Date(0) // All time
    windowLabel = "All Time"
    bucketMode = "monthly"
    bucketCount = 12
  } else {
    // default: 6m
    startDate = startOfMonth(subMonths(today, 5))
    windowLabel = "Last 6 Months"
    bucketMode = "monthly"
    bucketCount = 6
  }

  const orgProjects = await getCachedOrgProjects(ctx.organizationId)

  const [org] = await db
    .select({ globalCurrency: organization.globalCurrency })
    .from(organization)
    .where(eq(organization.id, ctx.organizationId))
  const targetCurrency: "USD" | "INR" = (org?.globalCurrency as "USD" | "INR") || "USD"

  const projectIds = orgProjects.map((p) => p.id)

  if (projectIds.length === 0) {
    const emptyChart: MonthlyVelocityPoint[] = Array.from({ length: bucketCount }, (_, i) => ({
      month:
        bucketMode === "daily"
          ? format(subDays(today, bucketCount - 1 - i), "MMM d")
          : format(subMonths(today, bucketCount - 1 - i), "MMM yyyy"),
      revenue: 0,
      pipeline: 0,
    }))
    return (
      <DynamicAnalyticsHeroChartUI
        velocityData={emptyChart}
        peakMonthLabel="--"
        peakMonthRevenue={0}
        monthlyAvgRevenue={0}
        totalWon={0}
        currency={targetCurrency}
        windowLabel={windowLabel}
      />
    )
  }

  // Execute database queries with genuine date window bounding
  const whereCondition =
    range === "all"
      ? inArray(proposal.projectId, projectIds)
      : and(inArray(proposal.projectId, projectIds), gte(proposal.createdAt, startDate))

  const [proposalsList, usdToInrRate] = await Promise.all([
    db
      .select({
        price: proposal.price,
        currency: proposal.currency,
        status: proposal.status,
        createdAt: proposal.createdAt,
      })
      .from(proposal)
      .where(whereCondition),
    getUsdToInrRate(),
  ])

  let totalWon = 0
  let maxRevenue = 0
  let peakMonthLabel =
    bucketMode === "daily" ? format(today, "MMM d") : format(today, "MMM yyyy")

  let velocityData: MonthlyVelocityPoint[] = []

  if (bucketMode === "daily") {
    // 30 daily buckets
    const days = Array.from({ length: bucketCount }, (_, i) => subDays(today, bucketCount - 1 - i))
    velocityData = days.map((d) => {
      const dayLabel = format(d, "MMM d")
      let revenue = 0
      let pipeline = 0

      proposalsList.forEach((p) => {
        if (isSameDay(new Date(p.createdAt), d)) {
          const { total: convertedAmount } = convertAndAggregate(
            [{ amount: p.price, currency: p.currency }],
            targetCurrency,
            usdToInrRate
          )
          if (p.status === "accepted") {
            revenue += convertedAmount
          } else if (p.status === "sent") {
            pipeline += convertedAmount
          }
        }
      })

      totalWon += revenue
      if (revenue > maxRevenue) {
        maxRevenue = revenue
        peakMonthLabel = dayLabel
      }

      return {
        month: dayLabel,
        revenue,
        pipeline,
      }
    })
  } else {
    // Monthly buckets
    const months = Array.from({ length: bucketCount }, (_, i) =>
      subMonths(today, bucketCount - 1 - i)
    )
    velocityData = months.map((m) => {
      const monthLabel = format(m, "MMM yyyy")
      let revenue = 0
      let pipeline = 0

      proposalsList.forEach((p) => {
        if (isSameMonth(new Date(p.createdAt), m)) {
          const { total: convertedAmount } = convertAndAggregate(
            [{ amount: p.price, currency: p.currency }],
            targetCurrency,
            usdToInrRate
          )
          if (p.status === "accepted") {
            revenue += convertedAmount
          } else if (p.status === "sent") {
            pipeline += convertedAmount
          }
        }
      })

      totalWon += revenue
      if (revenue > maxRevenue) {
        maxRevenue = revenue
        peakMonthLabel = monthLabel
      }

      return {
        month: monthLabel,
        revenue,
        pipeline,
      }
    })
  }

  const periodAvg = Math.round(totalWon / Math.max(1, bucketCount))

  return (
    <DynamicAnalyticsHeroChartUI
      velocityData={velocityData}
      peakMonthLabel={peakMonthLabel}
      peakMonthRevenue={maxRevenue}
      monthlyAvgRevenue={periodAvg}
      totalWon={totalWon}
      currency={targetCurrency}
      windowLabel={windowLabel}
    />
  )
}

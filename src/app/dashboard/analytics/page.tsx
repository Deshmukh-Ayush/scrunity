import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { AnalyticsKpiRow } from "@/components/dashboard/analytics/analytics-kpi-row"
import { AnalyticsHeroChart } from "@/components/dashboard/analytics/analytics-hero-chart"
import { AnalyticsBreakdowns } from "@/components/dashboard/analytics/analytics-breakdowns"
import { AnalyticsProjectTable } from "@/components/dashboard/analytics/analytics-project-table"
import { DashboardFilterToolbar } from "@/components/dashboard/shared/dashboard-filter-toolbar"

export default async function DashboardAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const { range = "6m" } = await searchParams

  const dateRangeOptions = [
    { label: "Last 30 Days", value: "30d" },
    { label: "Last 90 Days", value: "90d" },
    { label: "Last 6 Months", value: "6m" },
    { label: "Year to Date", value: "ytd" },
    { label: "All Time", value: "all" },
  ]

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {/* Header with Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Analytics & Insights</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time metrics on revenue velocity, proposal conversion, deliverable execution, and pipeline health.
          </p>
        </div>

        <div className="shrink-0">
          <DashboardFilterToolbar
            dateRangeConfig={{
              key: "range",
              defaultValue: "6m",
              options: dateRangeOptions,
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* Level 1: KPI Scoreboard */}
        <Suspense fallback={<Skeleton className="h-[140px] w-full rounded-md" />}>
          <AnalyticsKpiRow range={range} />
        </Suspense>

        {/* Level 2: Hero Velocity Chart */}
        <Suspense fallback={<Skeleton className="h-[380px] w-full rounded-md" />}>
          <AnalyticsHeroChart range={range} />
        </Suspense>

        {/* Level 3: Proposal Conversion & Execution Breakdowns */}
        <Suspense fallback={<Skeleton className="h-[300px] w-full rounded-md" />}>
          <AnalyticsBreakdowns range={range} />
        </Suspense>

        {/* Level 4: Project Performance Table */}
        <Suspense fallback={<Skeleton className="h-[360px] w-full rounded-md" />}>
          <AnalyticsProjectTable />
        </Suspense>
      </div>
    </div>
  )
}


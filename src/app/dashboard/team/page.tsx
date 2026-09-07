import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { TeamKpiRow } from "@/components/dashboard/team/team-kpi-row"
import { TeamAnalyticsBreakdown } from "@/components/dashboard/team/team-analytics-breakdown"
import { TeamWorkflowsTable } from "@/components/dashboard/team/team-workflows-table"
import { DashboardFilterToolbar } from "@/components/dashboard/shared/dashboard-filter-toolbar"

export default async function DashboardTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const { range = "30d" } = await searchParams

  const dateRangeOptions = [
    { label: "Last 7 Days", value: "7d" },
    { label: "Last 30 Days", value: "30d" },
    { label: "Last 90 Days", value: "90d" },
    { label: "All Time", value: "all" },
  ]

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {/* Header with Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Team Management & Workflows</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time visibility into team members, seat usage, role distribution, top contributors, and workflow activity.
          </p>
        </div>

        <div className="shrink-0">
          <DashboardFilterToolbar
            dateRangeConfig={{
              key: "range",
              defaultValue: "30d",
              options: dateRangeOptions,
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* Level 1: Seat Usage & Team Pace Scoreboard */}
        <Suspense fallback={<Skeleton className="h-[140px] w-full rounded-xl" />}>
          <TeamKpiRow range={range} />
        </Suspense>

        {/* Level 2: Top Contributors & Team Activity Stream (No forced vanity hero chart) */}
        <Suspense fallback={<Skeleton className="h-[320px] w-full rounded-xl" />}>
          <TeamAnalyticsBreakdown range={range} />
        </Suspense>

        {/* Level 3: Top Workflows by Activity Table */}
        <Suspense fallback={<Skeleton className="h-[360px] w-full rounded-xl" />}>
          <TeamWorkflowsTable />
        </Suspense>
      </div>
    </div>
  )
}


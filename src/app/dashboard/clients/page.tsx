import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { ClientsKpiRow } from "@/components/dashboard/clients/clients-kpi-row"
import { ClientsHeroChart } from "@/components/dashboard/clients/clients-hero-chart"
import { ClientsTable } from "@/components/dashboard/clients/clients-table"
import { DashboardFilterToolbar } from "@/components/dashboard/shared/dashboard-filter-toolbar"

export default async function DashboardClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; status?: string }>
}) {
  const { range = "6m", status = "all" } = await searchParams

  const statusOptions = [
    { label: "All", value: "all" },
    { label: "Active", value: "active" },
    { label: "Invited", value: "invited" },
  ]

  const dateRangeOptions = [
    { label: "Last 90 Days", value: "90d" },
    { label: "Last 6 Months", value: "6m" },
    { label: "Last 1 Year", value: "1y" },
    { label: "All Time", value: "all" },
  ]

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {/* Page Header with Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Clients</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage client relationships, track active proposals, and monitor contract sign-offs across your workspace.
          </p>
        </div>

        <div className="shrink-0">
          <DashboardFilterToolbar
            statusConfig={{
              key: "status",
              defaultValue: "all",
              options: statusOptions,
            }}
            dateRangeConfig={{
              key: "range",
              defaultValue: "6m",
              options: dateRangeOptions,
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* Level 1: 4-Card Executive KPI Scoreboard */}
        <Suspense fallback={<Skeleton className="h-[140px] w-full rounded-xl" />}>
          <ClientsKpiRow />
        </Suspense>

        {/* Level 2: Client Acquisition Velocity Hero Bar Chart */}
        <Suspense fallback={<Skeleton className="h-[380px] w-full rounded-xl" />}>
          <ClientsHeroChart range={range} />
        </Suspense>

        {/* Level 3: Client Management Table */}
        <Suspense fallback={<Skeleton className="h-[400px] w-full rounded-xl" />}>
          <ClientsTable status={status} />
        </Suspense>
      </div>
    </div>
  )
}


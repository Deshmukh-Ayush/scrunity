import { DashboardKpiRow } from "@/components/dashboard/overview/kpi-row"
import { DashboardAttentionTable } from "@/components/dashboard/overview/attention-table"
import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          High-level metrics and workspace performance.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <Suspense fallback={<Skeleton className="h-[140px] w-full rounded-md" />}>
          <DashboardKpiRow />
        </Suspense>

        <Suspense fallback={<Skeleton className="h-[280px] w-full rounded-md" />}>
          <DashboardAttentionTable />
        </Suspense>
      </div>
    </div>
  )
}

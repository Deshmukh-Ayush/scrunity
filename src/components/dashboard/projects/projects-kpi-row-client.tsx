"use client"

import {
  CurrencyInrIcon,
  CurrencyDollarIcon,
  FolderIcon,
  WarningCircleIcon,
  CheckCircleIcon,
  CheckSquareOffsetIcon,
} from "@phosphor-icons/react"
import { ConcentricCard } from "@/components/dashboard/shared/concentric-card"

export interface ProjectsKpiData {
  activeProjectsCount: number
  totalCommittedValue: number
  attentionCount: number
  deliverableCompletionRate: number
  approvedDeliverablesCount: number
  totalDeliverablesCount: number
  currency: "USD" | "INR"
  portfolioHealth: {
    onTrack: number
    actionRequired: number
    blocked: number
    completed: number
  }
}

export function ProjectsKpiRowClient({ data }: { data: ProjectsKpiData }) {
  const Icon = data.currency === "INR" ? CurrencyInrIcon : CurrencyDollarIcon
  const formattedCommitted =
    data.currency === "INR"
      ? `₹${data.totalCommittedValue.toLocaleString("en-IN")}`
      : `$${data.totalCommittedValue.toLocaleString("en-US")}`

  const totalActive =
    data.portfolioHealth.onTrack +
    data.portfolioHealth.actionRequired +
    data.portfolioHealth.blocked

  const onTrackPct =
    totalActive > 0 ? Math.round((data.portfolioHealth.onTrack / totalActive) * 100) : 0
  const actionPct =
    totalActive > 0 ? Math.round((data.portfolioHealth.actionRequired / totalActive) * 100) : 0
  const blockedPct =
    totalActive > 0 ? Math.max(0, 100 - onTrackPct - actionPct) : 0

  return (
    <div className="flex flex-col gap-4">
      {/* 4 Big-Number Executive KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Active Projects */}
        <ConcentricCard
          headerExtra={
            <div className="flex items-center justify-between w-full">
              <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <FolderIcon className="h-4 w-4 text-sky-500" /> Active Engagements
              </span>
              <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-xs font-semibold text-sky-600 dark:text-sky-400 tabular-nums">
                Active
              </span>
            </div>
          }
        >
          <div className="space-y-1">
            <div className="text-[28px] leading-tight font-semibold tracking-tight text-foreground tabular-nums">
              {data.activeProjectsCount}
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Running client projects
            </p>
          </div>
        </ConcentricCard>

        {/* KPI 2: Committed Value */}
        <ConcentricCard
          headerExtra={
            <div className="flex items-center justify-between w-full">
              <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <Icon className="h-4 w-4 text-emerald-500" /> Committed Value
              </span>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                Accepted SOWs
              </span>
            </div>
          }
        >
          <div className="space-y-1">
            <div className="text-[28px] leading-tight font-semibold tracking-tight text-foreground tabular-nums">
              {formattedCommitted}
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Total pipeline value
            </p>
          </div>
        </ConcentricCard>

        {/* KPI 3: Projects Needing Attention */}
        <ConcentricCard
          headerExtra={
            <div className="flex items-center justify-between w-full">
              <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {data.attentionCount > 0 ? (
                  <WarningCircleIcon className="h-4 w-4 text-destructive" />
                ) : (
                  <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
                )}
                Attention Required
              </span>
              <span
                className={
                  data.attentionCount > 0
                    ? "rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive tabular-nums"
                    : "rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums"
                }
              >
                {data.attentionCount > 0 ? "Action needed" : "All on track"}
              </span>
            </div>
          }
        >
          <div className="space-y-1">
            <div
              className={`text-[28px] leading-tight font-semibold tracking-tight tabular-nums ${
                data.attentionCount > 0 ? "text-destructive" : "text-foreground"
              }`}
            >
              {data.attentionCount}
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {data.attentionCount > 0
                ? "Projects with active blockers"
                : "All engagements on track"}
            </p>
          </div>
        </ConcentricCard>

        {/* KPI 4: Deliverable Progress */}
        <ConcentricCard
          headerExtra={
            <div className="flex items-center justify-between w-full">
              <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <CheckSquareOffsetIcon className="h-4 w-4 text-emerald-500" /> Delivery Progress
              </span>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {data.deliverableCompletionRate}%
              </span>
            </div>
          }
        >
          <div className="space-y-1">
            <div className="text-[28px] leading-tight font-semibold tracking-tight text-foreground tabular-nums">
              {data.approvedDeliverablesCount} / {data.totalDeliverablesCount}
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Approved client deliverables
            </p>
          </div>
        </ConcentricCard>
      </div>

      {/* Portfolio Health Breakdown Bar */}
      {totalActive > 0 && (
        <div className="rounded-xl border border-border/40 bg-neutral-100 p-1 shadow-xs dark:bg-neutral-900 transition-shadow">
          <div className="flex items-center justify-between py-1 px-2.5">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Portfolio Health Breakdown
            </span>
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
              {totalActive} active project{totalActive !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="rounded-lg bg-white p-4 dark:bg-neutral-950 space-y-3.5">
            {/* Multi-segment Progress Bar */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted/60 flex">
              {onTrackPct > 0 && (
                <div
                  style={{ width: `${onTrackPct}%` }}
                  className="h-full bg-emerald-500 transition-[width] duration-300 ease-out"
                  title={`On track: ${data.portfolioHealth.onTrack} (${onTrackPct}%)`}
                />
              )}
              {actionPct > 0 && (
                <div
                  style={{ width: `${actionPct}%` }}
                  className="h-full bg-amber-500 transition-[width] duration-300 ease-out"
                  title={`Action needed: ${data.portfolioHealth.actionRequired} (${actionPct}%)`}
                />
              )}
              {blockedPct > 0 && (
                <div
                  style={{ width: `${blockedPct}%` }}
                  className="h-full bg-destructive transition-[width] duration-300 ease-out"
                  title={`Blocked or overdue: ${data.portfolioHealth.blocked} (${blockedPct}%)`}
                />
              )}
            </div>

            {/* Legend with counts */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-muted-foreground">On track:</span>
                <span className="font-semibold text-foreground tabular-nums">
                  {data.portfolioHealth.onTrack}
                </span>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  ({onTrackPct}%)
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0" />
                <span className="text-muted-foreground">Action needed:</span>
                <span className="font-semibold text-foreground tabular-nums">
                  {data.portfolioHealth.actionRequired}
                </span>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  ({actionPct}%)
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-destructive shrink-0" />
                <span className="text-muted-foreground">Blocked or overdue:</span>
                <span className="font-semibold text-foreground tabular-nums">
                  {data.portfolioHealth.blocked}
                </span>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  ({blockedPct}%)
                </span>
              </div>

              {data.portfolioHealth.completed > 0 && (
                <div className="flex items-center gap-1.5 ml-auto text-muted-foreground">
                  <span>Completed:</span>
                  <span className="font-semibold text-foreground tabular-nums">
                    {data.portfolioHealth.completed}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

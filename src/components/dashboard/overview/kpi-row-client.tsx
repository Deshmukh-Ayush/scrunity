"use client"

import {
  CurrencyInrIcon,
  CurrencyDollarIcon,
  FolderIcon,
  ClockIcon,
  WarningCircleIcon,
  CheckCircleIcon,
} from "@phosphor-icons/react"
import { ConcentricCard } from "@/components/dashboard/shared/concentric-card"

interface DashboardKpiRowUIProps {
  totalIncome: number
  pendingCollection: number
  activeProjectsCount: number
  attentionItemsCount: number
  currency?: "USD" | "INR"
}

export function DashboardKpiRowUI({
  totalIncome,
  pendingCollection,
  activeProjectsCount,
  attentionItemsCount,
  currency = "USD",
}: DashboardKpiRowUIProps) {
  const Icon = currency === "INR" ? CurrencyInrIcon : CurrencyDollarIcon
  const formattedIncome =
    currency === "INR"
      ? `₹${totalIncome.toLocaleString("en-IN")}`
      : `$${totalIncome.toLocaleString("en-US")}`

  const formattedPending =
    currency === "INR"
      ? `₹${pendingCollection.toLocaleString("en-IN")}`
      : `$${pendingCollection.toLocaleString("en-US")}`

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* KPI 1: Won Revenue */}
      <ConcentricCard
        headerExtra={
          <div className="flex items-center justify-between w-full">
            <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <Icon className="h-4 w-4 text-emerald-500" /> Won Revenue
            </span>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold tracking-wider text-emerald-600 uppercase dark:text-emerald-400 tabular-nums">
              Closed
            </span>
          </div>
        }
      >
        <div className="space-y-1">
          <div className="text-[28px] leading-tight font-semibold tracking-tight text-foreground tabular-nums">
            {formattedIncome}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            From accepted proposals
          </p>
        </div>
      </ConcentricCard>

      {/* KPI 2: Pending Collection */}
      <ConcentricCard
        headerExtra={
          <div className="flex items-center justify-between w-full">
            <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <ClockIcon className="h-4 w-4 text-amber-500" /> Pending Collection
            </span>
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold tracking-wider text-amber-600 uppercase dark:text-amber-400 tabular-nums">
              In flight
            </span>
          </div>
        }
      >
        <div className="space-y-1">
          <div className="text-[28px] leading-tight font-semibold tracking-tight text-foreground tabular-nums">
            {formattedPending}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Due & overdue milestones
          </p>
        </div>
      </ConcentricCard>

      {/* KPI 3: Active Projects */}
      <ConcentricCard
        headerExtra={
          <div className="flex items-center justify-between w-full">
            <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <FolderIcon className="h-4 w-4 text-sky-500" /> Active Projects
            </span>
            <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-xs font-semibold tracking-wider text-sky-600 uppercase dark:text-sky-400 tabular-nums">
              Active
            </span>
          </div>
        }
      >
        <div className="space-y-1">
          <div className="text-[28px] leading-tight font-semibold tracking-tight text-foreground tabular-nums">
            {activeProjectsCount}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Client engagements
          </p>
        </div>
      </ConcentricCard>

      {/* KPI 4: Attention Required */}
      <ConcentricCard
        headerExtra={
          <div className="flex items-center justify-between w-full">
            <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {attentionItemsCount > 0 ? (
                <WarningCircleIcon className="h-4 w-4 text-destructive" />
              ) : (
                <CheckCircleIcon className="h-4 w-4 text-emerald-500" />
              )}
              Attention
            </span>
            <span
              className={
                attentionItemsCount > 0
                  ? "rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold tracking-wider text-destructive uppercase tabular-nums"
                  : "rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold tracking-wider text-emerald-600 uppercase dark:text-emerald-400 tabular-nums"
              }
            >
              {attentionItemsCount > 0 ? "Action needed" : "Healthy"}
            </span>
          </div>
        }
      >
        <div className="space-y-1">
          <div
            className={`text-[28px] leading-tight font-semibold tracking-tight tabular-nums ${
              attentionItemsCount > 0 ? "text-destructive" : "text-foreground"
            }`}
          >
            {attentionItemsCount}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {attentionItemsCount > 0 ? "Blockers needing action" : "Zero open blockers"}
          </p>
        </div>
      </ConcentricCard>
    </div>
  )
}

"use client"

import { PieChart, CheckSquare } from "lucide-react"
import { ConcentricCard } from "@/components/dashboard/shared/concentric-card"

export interface ProposalBreakdownItem {
  name: string
  value: number
  color: string
}

export interface DeliverableHealthItem {
  label: string
  count: number
  percentage: number
  color: string
}

interface AnalyticsBreakdownsUIProps {
  proposalBreakdown: ProposalBreakdownItem[]
  deliverableHealth: DeliverableHealthItem[]
}

export function AnalyticsBreakdownsUI({
  proposalBreakdown,
  deliverableHealth,
}: AnalyticsBreakdownsUIProps) {
  const totalProposals = proposalBreakdown.reduce((sum, item) => sum + item.value, 0)

  // Donut geometry for continuous SVG ring
  const radius = 42
  const strokeWidth = 12
  const circumference = 2 * Math.PI * radius

  let cumulativePercent = 0
  const donutSlices = proposalBreakdown
    .filter((item) => item.value > 0)
    .map((item) => {
      const pct = totalProposals > 0 ? (item.value / totalProposals) * 100 : 0
      const startPercent = cumulativePercent
      cumulativePercent += pct
      return {
        ...item,
        pct: Math.round(pct),
        startPercent,
        endPercent: cumulativePercent,
      }
    })

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {/* Proposal Status Distribution — Proper Donut Chart */}
      <ConcentricCard
        headerExtra={
          <div className="flex items-center justify-between w-full">
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground uppercase tracking-wide">
              <PieChart className="h-4 w-4 text-emerald-500" /> Proposal Status Breakdown
            </span>
            <span className="text-xs text-muted-foreground font-medium tabular-nums">
              {totalProposals} Total Proposals
            </span>
          </div>
        }
        innerClassName="p-5"
      >
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-1">
          {/* SVG Donut Ring */}
          <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
              {/* Background Ring */}
              <circle
                cx="60"
                cy="60"
                r={radius}
                stroke="currentColor"
                strokeWidth={strokeWidth}
                fill="transparent"
                className="text-muted/30"
              />
              {/* Slices */}
              {donutSlices.map((slice) => {
                const strokeDasharray = `${(slice.pct / 100) * circumference} ${circumference}`
                const strokeDashoffset = -((slice.startPercent / 100) * circumference)
                return (
                  <circle
                    key={slice.name}
                    cx="60"
                    cy="60"
                    r={radius}
                    stroke={slice.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    fill="transparent"
                    strokeLinecap="butt"
                    className="transition-all duration-300"
                  />
                )
              })}
            </svg>

            {/* Centered Total Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums leading-none">
                {totalProposals}
              </span>
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">
                Proposals
              </span>
            </div>
          </div>

          {/* Legend Grid */}
          <div className="grid grid-cols-1 gap-2.5 w-full max-w-xs">
            {proposalBreakdown.map((item) => {
              const pct = totalProposals > 0 ? Math.round((item.value / totalProposals) * 100) : 0
              return (
                <div
                  key={item.name}
                  className="flex items-center justify-between p-2 rounded-md border border-border/30 bg-muted/20 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="font-medium text-foreground truncate">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2 tabular-nums">
                    <span className="font-semibold text-foreground">{item.value}</span>
                    <span className="text-muted-foreground text-[11px]">({pct}%)</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </ConcentricCard>

      {/* Deliverable Execution Health */}
      <ConcentricCard
        headerExtra={
          <div className="flex items-center justify-between w-full">
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground uppercase tracking-wide">
              <CheckSquare className="h-4 w-4 text-emerald-500" /> Deliverable Execution Health
            </span>
            <span className="text-xs text-muted-foreground font-medium">
              Review Status
            </span>
          </div>
        }
        innerClassName="p-5 space-y-4"
      >
        <div className="space-y-3">
          {deliverableHealth.map((item) => (
            <div key={item.label} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.label}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {item.count} ({item.percentage}%)
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </ConcentricCard>
    </div>
  )
}

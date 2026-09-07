"use client"

import { Users, UserCheck, Shield, Zap } from "lucide-react"
import { ConcentricCard } from "@/components/dashboard/shared/concentric-card"

export interface TeamKpiData {
  activeSeats: number
  maxSeats: number
  activeContributors: number
  ownerCount: number
  adminCount: number
  memberCount: number
  teamPace: number
  periodLabel?: string
  periodDescription?: string
}

export function TeamKpiRowClient({ data }: { data: TeamKpiData }) {
  const seatPct = data.maxSeats > 0 ? Math.round((data.activeSeats / data.maxSeats) * 100) : 0

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* KPI 1: Seat Usage */}
      <ConcentricCard
        headerExtra={
          <div className="flex items-center justify-between w-full">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              <Users className="h-3.5 w-3.5 text-brand" /> Seat Capacity
            </span>
            <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-brand uppercase tabular-nums">
              {seatPct}% Used
            </span>
          </div>
        }
        innerClassName="p-4 space-y-3"
      >
        <div>
          <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {data.activeSeats} / {data.maxSeats}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Seats filled on current plan
          </p>
        </div>
      </ConcentricCard>

      {/* KPI 2: Active Contributors */}
      <ConcentricCard
        headerExtra={
          <div className="flex items-center justify-between w-full">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              <UserCheck className="h-3.5 w-3.5 text-emerald-500" /> Active Contributors
            </span>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-emerald-600 uppercase dark:text-emerald-400 tabular-nums">
              7-Day Active
            </span>
          </div>
        }
        innerClassName="p-4 space-y-3"
      >
        <div>
          <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {data.activeContributors}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Teammates active in last 7 days
          </p>
        </div>
      </ConcentricCard>

      {/* KPI 3: Role Distribution */}
      <ConcentricCard
        headerExtra={
          <div className="flex items-center justify-between w-full">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              <Shield className="h-3.5 w-3.5 text-amber-500" /> Role Distribution
            </span>
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-amber-600 uppercase dark:text-amber-400 tabular-nums">
              Roles
            </span>
          </div>
        }
        innerClassName="p-4 space-y-3"
      >
        <div>
          <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {data.ownerCount} Owner · {data.memberCount} Members
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Access hierarchy & permissions
          </p>
        </div>
      </ConcentricCard>

      {/* KPI 4: Team Execution Pace */}
      <ConcentricCard
        headerExtra={
          <div className="flex items-center justify-between w-full">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              <Zap className="h-3.5 w-3.5 text-sky-500" /> Team Pace
            </span>
            <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-sky-600 uppercase dark:text-sky-400 tabular-nums">
              {data.periodLabel || "Monthly"}
            </span>
          </div>
        }
        innerClassName="p-4 space-y-3"
      >
        <div>
          <div className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {data.teamPace} Actions
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Total team operations {data.periodDescription || "in this period"}
          </p>
        </div>
      </ConcentricCard>
    </div>
  )
}

"use client"

import {
  CurrencyInrIcon,
  CurrencyDollarIcon,
  UsersThree,
  ClockIcon,
  CheckCircleIcon,
} from "@phosphor-icons/react"
import { ConcentricCard } from "@/components/dashboard/shared/concentric-card"

export interface ClientsKpiData {
  activeClientsCount: number
  invitedClientsCount: number
  avgContractValue: number
  totalWonRevenue: number
  currency: "USD" | "INR"
  pendingActionCount: number
  pendingContractsCount: number
  pendingInvoicesCount: number
  proposalWinRate: number
  acceptedProposalsCount: number
  totalClosedProposalsCount: number
}

export function ClientsKpiRowClient({ data }: { data: ClientsKpiData }) {
  const Icon = data.currency === "INR" ? CurrencyInrIcon : CurrencyDollarIcon

  const formatMoney = (amount: number) => {
    if (data.currency === "INR") {
      return `?${amount.toLocaleString("en-IN")}`
    }
    return `$${amount.toLocaleString("en-US")}`
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* KPI 1: Active Clients */}
      <ConcentricCard
        headerExtra={
          <div className="flex items-center justify-between w-full">
            <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <UsersThree className="h-4 w-4 text-sky-500" /> Active Clients
            </span>
            <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-xs font-semibold text-sky-600 dark:text-sky-400 tabular-nums">
              {data.invitedClientsCount > 0 ? `${data.invitedClientsCount} invited` : "Active"}
            </span>
          </div>
        }
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {data.activeClientsCount}
            </span>
            <span className="text-xs text-muted-foreground">accounts</span>
          </div>
          <span className="text-xs text-muted-foreground font-medium">
            Active client stakeholders across projects
          </span>
        </div>
      </ConcentricCard>

      {/* KPI 2: Avg Contract Value */}
      <ConcentricCard
        headerExtra={
          <div className="flex items-center justify-between w-full">
            <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <Icon className="h-4 w-4 text-emerald-500" /> Avg Client Value
            </span>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
              Avg / Client
            </span>
          </div>
        }
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {formatMoney(data.avgContractValue)}
            </span>
          </div>
          <span className="text-xs text-muted-foreground font-medium">
            Total won: {formatMoney(data.totalWonRevenue)}
          </span>
        </div>
      </ConcentricCard>

      {/* KPI 3: Pending Client Action */}
      <ConcentricCard
        headerExtra={
          <div className="flex items-center justify-between w-full">
            <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <ClockIcon
                className={`h-4 w-4 ${
                  data.pendingActionCount > 0 ? "text-amber-500" : "text-emerald-500"
                }`}
              />{" "}
              Pending Client Action
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${
                data.pendingActionCount > 0
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              }`}
            >
              {data.pendingActionCount > 0 ? "Action Required" : "All Caught Up"}
            </span>
          </div>
        }
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {data.pendingActionCount}
            </span>
            <span className="text-xs text-muted-foreground">items</span>
          </div>
          <span className="text-xs text-muted-foreground font-medium">
            {data.pendingContractsCount} contracts, {data.pendingInvoicesCount} invoices pending
          </span>
        </div>
      </ConcentricCard>

      {/* KPI 4: Proposal Win Rate */}
      <ConcentricCard
        headerExtra={
          <div className="flex items-center justify-between w-full">
            <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <CheckCircleIcon className="h-4 w-4 text-sky-500" /> Proposal Win Rate
            </span>
            <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-xs font-semibold text-sky-600 dark:text-sky-400 tabular-nums">
              {data.acceptedProposalsCount}/{data.totalClosedProposalsCount} won
            </span>
          </div>
        }
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
              {data.proposalWinRate}%
            </span>
          </div>
          <span className="text-xs text-muted-foreground font-medium">
            Accepted proposals out of all closed
          </span>
        </div>
      </ConcentricCard>
    </div>
  )
}

"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowRightIcon, CheckCircleIcon, ClockIcon } from "@phosphor-icons/react"
import { format } from "date-fns"
import { DataTableShell } from "@/components/dashboard/shared/data-table-shell"
import { DeliverableProgressBar } from "@/components/dashboard/shared/deliverable-progress-bar"
import { SlidingPillTabs } from "@/components/dashboard/shared/sliding-pill-tabs"

export interface WorkflowItem {
  id: string
  name: string
  description: string | null
  status: "active" | "completed" | "archived"
  activityCount: number
  approvedDeliverables: number
  totalDeliverables: number
  updatedAt: string
  creator: {
    id: string
    name: string
    email: string
    image: string | null
  } | null
}

const TABLE_HEADERS = ["Workflow / Project", "Owner", "Activity Volume", "Deliverable Progress", "Status", "Last Activity", "Action"]

export function TeamWorkflowsTableClient({ workflows }: { workflows: WorkflowItem[] }) {
  const [statusFilter, setStatusFilter] = React.useState<"all" | "active" | "completed">("all")

  const filteredWorkflows = React.useMemo(() => {
    if (statusFilter === "all") return workflows
    return workflows.filter((w) => w.status === statusFilter)
  }, [workflows, statusFilter])

  const activeCount = workflows.filter((w) => w.status === "active").length
  const completedCount = workflows.filter((w) => w.status === "completed").length

  const tabs = [
    { id: "all" as const, label: "All workflows", count: workflows.length },
    { id: "active" as const, label: "Active", count: activeCount },
    { id: "completed" as const, label: "Completed", count: completedCount },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Sliding Pill Filter Tabs */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
          Top Workflows by Activity
        </h2>
        <SlidingPillTabs
          layoutId="activeTeamWorkflowsTabPill"
          tabs={tabs}
          activeTab={statusFilter}
          onChange={setStatusFilter}
        />
      </div>

      <DataTableShell headers={TABLE_HEADERS}>
        {filteredWorkflows.length === 0 ? (
          <tr>
            <td colSpan={7} className="p-8 text-center text-xs text-muted-foreground">
              No matching workflows found.
            </td>
          </tr>
        ) : (
          filteredWorkflows.map((w) => (
            <tr
              key={w.id}
              className="group transition-colors hover:bg-neutral-50/80 dark:hover:bg-neutral-900/40"
            >
              {/* Workflow Info */}
              <td className="px-5 py-3.5">
                <div className="flex flex-col min-w-0">
                  <Link
                    href={`/projects/${w.id}`}
                    className="font-semibold text-foreground hover:text-brand hover:underline truncate text-sm transition-colors"
                  >
                    {w.name}
                  </Link>
                  {w.description ? (
                    <span className="text-xs text-muted-foreground truncate max-w-xs">
                      {w.description}
                    </span>
                  ) : null}
                </div>
              </td>

              {/* Creator / Owner */}
              <td className="px-4 py-3.5 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full border bg-muted">
                    {w.creator?.image ? (
                      <Image src={w.creator.image} alt={w.creator.name || "Team member"} fill className="object-cover" unoptimized />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[9px] font-semibold text-brand bg-brand/10">
                        {(w.creator?.name || w.creator?.email || "T").charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-foreground font-medium truncate max-w-[120px]">
                    {w.creator?.name || "Agency Teammate"}
                  </span>
                </div>
              </td>

              {/* Activity Volume */}
              <td className="px-4 py-3.5 whitespace-nowrap">
                <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-bold text-brand tabular-nums">
                  {w.activityCount} actions
                </span>
              </td>

              {/* Progress */}
              <td className="px-4 py-3.5 whitespace-nowrap">
                <DeliverableProgressBar
                  approved={w.approvedDeliverables}
                  total={w.totalDeliverables}
                />
              </td>

              {/* Status */}
              <td className="px-4 py-3.5 whitespace-nowrap">
                {w.status === "completed" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircleIcon className="h-3.5 w-3.5" /> Completed
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-600 dark:text-sky-400">
                    <ClockIcon className="h-3.5 w-3.5" /> Active
                  </span>
                )}
              </td>

              {/* Last Action Date */}
              <td className="px-4 py-3.5 whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                {format(new Date(w.updatedAt), "MMM d, yyyy")}
              </td>

              {/* Action Link */}
              <td className="px-4 py-3.5 text-right whitespace-nowrap">
                <Link
                  href={`/projects/${w.id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:text-brand-hover transition-colors active:scale-[0.96] origin-center"
                >
                  <span>Open workflow</span>
                  <ArrowRightIcon className="h-3.5 w-3.5" />
                </Link>
              </td>
            </tr>
          ))
        )}
      </DataTableShell>
    </div>
  )
}

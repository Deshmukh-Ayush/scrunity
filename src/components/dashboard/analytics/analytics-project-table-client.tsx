"use client"

import Link from "next/link"
import { ArrowRightIcon, WarningIcon, CheckCircleIcon, ClockIcon } from "@phosphor-icons/react"
import { DataTableShell } from "@/components/dashboard/shared/data-table-shell"
import { DeliverableProgressBar } from "@/components/dashboard/shared/deliverable-progress-bar"
import { AvatarStack } from "@/components/dashboard/shared/avatar-stack"

export interface AnalyticsProjectPerformanceItem {
  id: string
  name: string
  description: string | null
  totalValue: number | null
  currency?: string
  proposalStatus: string | null
  approvedDeliverables: number
  totalDeliverables: number
  revisionRequests: number
  members: {
    id: string
    name: string | null
    email: string
    image: string | null
  }[]
}

function formatCurrency(amount: number, currency: string = "USD") {
  if (currency === "INR") return `₹${amount.toLocaleString("en-IN")}`
  return `$${amount.toLocaleString("en-US")}`
}

const TABLE_HEADERS = ["Project", "Contract Value", "Deal Status", "Deliverables", "Scope Friction", "Team", "Action"]

export function AnalyticsProjectTableClient({
  projects,
}: {
  projects: AnalyticsProjectPerformanceItem[]
}) {
  if (projects.length === 0) {
    return (
      <div className="rounded-xl border border-border/40 bg-neutral-100 p-1 shadow-xs dark:bg-neutral-900 transition-shadow">
        <div className="flex flex-col rounded-lg bg-white p-6 shadow-xs dark:bg-neutral-950 text-center">
          <h3 className="text-sm font-semibold text-foreground">No active project performance data</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Create projects and proposals to track workspace analytics.
          </p>
        </div>
      </div>
    )
  }

  return (
    <DataTableShell
      title="Project Performance & Scope Health"
      description="Financial value, deliverable completion, and revision friction per project."
      headers={TABLE_HEADERS}
    >
      {projects.map((p) => (
        <tr
          key={p.id}
          className="group transition-colors hover:bg-neutral-50/80 dark:hover:bg-neutral-900/40"
        >
          {/* Project Info */}
          <td className="px-5 py-3.5">
            <div className="flex flex-col min-w-0">
              <Link
                href={`/projects/${p.id}`}
                className="font-semibold text-foreground hover:text-brand hover:underline truncate text-sm transition-colors"
              >
                {p.name}
              </Link>
              {p.description ? (
                <span className="text-xs text-muted-foreground truncate max-w-xs">
                  {p.description}
                </span>
              ) : null}
            </div>
          </td>

          {/* Value */}
          <td className="px-4 py-3.5 whitespace-nowrap font-medium text-foreground tabular-nums">
            {p.totalValue ? formatCurrency(p.totalValue, p.currency) : "--"}
          </td>

          {/* Deal Status */}
          <td className="px-4 py-3.5 whitespace-nowrap">
            {p.proposalStatus === "accepted" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircleIcon className="h-3 w-3" /> Won
              </span>
            ) : p.proposalStatus === "sent" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                <ClockIcon className="h-3 w-3" /> Pending
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {p.proposalStatus || "Draft"}
              </span>
            )}
          </td>

          {/* Deliverables Progress */}
          <td className="px-4 py-3.5 whitespace-nowrap">
            <DeliverableProgressBar
              approved={p.approvedDeliverables}
              total={p.totalDeliverables}
            />
          </td>

          {/* Scope Friction (Revision Requests) */}
          <td className="px-4 py-3.5 whitespace-nowrap">
            {p.revisionRequests > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                <WarningIcon className="h-3 w-3" />
                {p.revisionRequests} revisions
              </span>
            ) : (
              <span className="text-xs text-muted-foreground font-medium">
                0 revisions
              </span>
            )}
          </td>

          {/* Team Avatars */}
          <td className="px-4 py-3.5 whitespace-nowrap">
            <AvatarStack members={p.members} max={3} />
          </td>

          {/* Action Link */}
          <td className="px-4 py-3.5 text-right whitespace-nowrap">
            <Link
              href={`/projects/${p.id}`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:text-brand-hover transition-colors active:scale-[0.96] origin-center"
            >
              <span>Open project</span>
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </td>
        </tr>
      ))}
    </DataTableShell>
  )
}

"use client"

import {
  CheckCircleIcon,
  ClockIcon,
  WarningIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react"

interface ProjectsStatusBadgeProps {
  status: string
  healthStatus?: "on_track" | "action_required" | "blocked" | "completed"
}

export function ProjectsStatusBadge({ status, healthStatus }: ProjectsStatusBadgeProps) {
  if (status === "completed" || healthStatus === "completed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/80 border border-border/40 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
        <CheckCircleIcon className="h-3.5 w-3.5" />
        <span>Completed</span>
      </span>
    )
  }

  if (healthStatus === "blocked") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 border border-destructive/25 px-2.5 py-0.5 text-[11px] font-medium text-destructive">
        <WarningCircleIcon className="h-3.5 w-3.5" />
        <span>Blocked</span>
      </span>
    )
  }

  if (healthStatus === "action_required") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/25 px-2.5 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
        <WarningIcon className="h-3.5 w-3.5" />
        <span>Action needed</span>
      </span>
    )
  }

  if (healthStatus === "on_track" || status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
        <span>On track</span>
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/80 border border-border/40 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground capitalize">
      <ClockIcon className="h-3.5 w-3.5" />
      <span>{status}</span>
    </span>
  )
}


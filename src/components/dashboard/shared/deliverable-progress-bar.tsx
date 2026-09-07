"use client"

import { cn } from "@/lib/utils"

export interface DeliverableProgressBarProps {
  approved: number
  total: number
  className?: string
}

export function DeliverableProgressBar({ approved, total, className }: DeliverableProgressBarProps) {
  const progressPct = total > 0 ? Math.round((approved / total) * 100) : 0

  return (
    <div className={cn("flex flex-col gap-1 w-32", className)}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="tabular-nums">
          {approved}/{total} done
        </span>
        <span className="tabular-nums font-semibold text-foreground">
          {progressPct}%
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  )
}

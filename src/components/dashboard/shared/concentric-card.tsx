"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface ConcentricCardProps {
  label?: React.ReactNode
  icon?: React.ElementType
  badge?: React.ReactNode
  headerExtra?: React.ReactNode
  className?: string
  innerClassName?: string
  children: React.ReactNode
}

export function ConcentricCard({
  label,
  icon: Icon,
  badge,
  headerExtra,
  className,
  innerClassName,
  children,
}: ConcentricCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border border-border/40 bg-neutral-100 p-1 shadow-xs dark:bg-neutral-900 transition-[box-shadow,border-color] duration-200",
        className
      )}
    >
      {label || badge || headerExtra ? (
        <div className="flex items-center justify-between py-1 px-1.5">
          {label ? (
            <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              {Icon && <Icon className="h-3.5 w-3.5 text-brand" />}
              {label}
            </span>
          ) : null}
          {badge}
          {headerExtra}
        </div>
      ) : null}
      <div
        className={cn(
          "rounded-lg bg-white p-4 sm:p-5 dark:bg-neutral-950 flex flex-col gap-4 h-full justify-between",
          innerClassName
        )}
      >
        {children}
      </div>
    </div>
  )
}

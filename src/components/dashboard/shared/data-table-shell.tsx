"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export interface DataTableShellProps {
  title?: string
  description?: string
  headers: string[]
  children: React.ReactNode
  className?: string
}

export function DataTableShell({
  title,
  description,
  headers,
  children,
  className,
}: DataTableShellProps) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border border-border/40 bg-neutral-100 p-1 shadow-xs dark:bg-neutral-900 transition-shadow",
        className
      )}
    >
      <div className="overflow-hidden rounded-lg bg-white dark:bg-neutral-950">
        {title ? (
          <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
                {title}
              </h2>
              {description ? (
                <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider bg-neutral-50/50 dark:bg-neutral-900/50">
                {headers.map((h, i) => (
                  <th
                    key={h}
                    className={cn(
                      "py-3",
                      i === 0 ? "px-5" : "px-4",
                      i === headers.length - 1 ? "text-right" : ""
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">{children}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

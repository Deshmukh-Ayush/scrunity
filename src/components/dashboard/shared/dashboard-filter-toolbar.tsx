"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { CaretDownIcon, MagnifyingGlassIcon } from "@phosphor-icons/react"
import { motion, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"

export interface FilterOption {
  label: string
  value: string
}

export interface DashboardFilterToolbarProps {
  searchConfig?: {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    ariaLabel?: string
  }
  statusConfig?: {
    key?: string
    defaultValue?: string
    options: FilterOption[]
  }
  dateRangeConfig?: {
    key?: string
    defaultValue?: string
    options: FilterOption[]
  }
  sortConfig?: {
    key?: string
    defaultValue?: string
    options: FilterOption[]
  }
  className?: string
  children?: React.ReactNode
}

export function DashboardFilterToolbar({
  searchConfig,
  statusConfig,
  dateRangeConfig,
  sortConfig,
  className = "",
  children,
}: DashboardFilterToolbarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const reduceMotion = useReducedMotion()

  const handleUpdateParam = React.useCallback(
    (key: string, value: string, defaultValue: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value === defaultValue) {
        params.delete(key)
      } else {
        params.set(key, value)
      }
      const queryStr = params.toString()
      router.replace(queryStr ? `${pathname}?${queryStr}` : pathname, { scroll: false })
    },
    [router, pathname, searchParams]
  )

  const currentStatus =
    searchParams.get(statusConfig?.key || "status") || statusConfig?.defaultValue || "all"
  const currentRange =
    searchParams.get(dateRangeConfig?.key || "range") || dateRangeConfig?.defaultValue || "6m"
  const currentSort =
    searchParams.get(sortConfig?.key || "sort") || sortConfig?.defaultValue || "updated"

  return (
    <div className={`flex flex-wrap items-center justify-between gap-2.5 ${className}`}>
      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
        {/* Search Input (if provided) */}
        {searchConfig && (
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchConfig.value}
              onChange={(e) => searchConfig.onChange(e.target.value)}
              placeholder={searchConfig.placeholder || "Search..."}
              aria-label={searchConfig.ariaLabel || searchConfig.placeholder || "Search"}
              className="h-8 w-full rounded-full border border-border/50 bg-neutral-100 dark:bg-neutral-900/80 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-brand shadow-xs hover:border-border transition-[border-color,box-shadow]"
            />
          </div>
        )}

        {/* Status Filter Pills (if provided) */}
        {statusConfig && statusConfig.options.length > 0 && (
          <div className="relative flex items-center gap-1 p-0.5 rounded-full border border-border/50 bg-neutral-100 dark:bg-neutral-900/80">
            {statusConfig.options.map((opt) => {
              const isActive = currentStatus === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() =>
                    handleUpdateParam(
                      statusConfig.key || "status",
                      opt.value,
                      statusConfig.defaultValue || "all"
                    )
                  }
                  className={cn(
                    "relative z-10 h-7 px-3 text-[11px] font-semibold rounded-full select-none active:scale-[0.96] transition-[color,transform] duration-150",
                    isActive
                      ? "text-background"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId={`activeToolbarPill-${statusConfig.key || "status"}`}
                      className="absolute inset-0 -z-10 rounded-full bg-foreground shadow-xs"
                      transition={
                        reduceMotion
                          ? { duration: 0 }
                          : { type: "spring", stiffness: 380, damping: 32, mass: 0.6 }
                      }
                    />
                  )}
                  <span className="relative z-10">{opt.label}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Date Range Dropdown (if provided) */}
        {dateRangeConfig && dateRangeConfig.options.length > 0 && (
          <div className="relative inline-flex items-center">
            <select
              value={currentRange}
              onChange={(e) =>
                handleUpdateParam(
                  dateRangeConfig.key || "range",
                  e.target.value,
                  dateRangeConfig.defaultValue || "6m"
                )
              }
              aria-label="Filter by date range"
              className="h-8 pl-3 pr-7 text-[12px] font-semibold rounded-full border border-border/50 bg-neutral-100 dark:bg-neutral-900/80 text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand shadow-xs hover:border-border transition-colors"
            >
              {dateRangeConfig.options.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-background text-foreground">
                  {opt.label}
                </option>
              ))}
            </select>
            <CaretDownIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          </div>
        )}

        {/* Sort Dropdown (if provided) */}
        {sortConfig && sortConfig.options.length > 0 && (
          <div className="relative inline-flex items-center">
            <select
              value={currentSort}
              onChange={(e) =>
                handleUpdateParam(
                  sortConfig.key || "sort",
                  e.target.value,
                  sortConfig.defaultValue || "updated"
                )
              }
              aria-label="Sort by"
              className="h-8 pl-3 pr-7 text-[12px] font-semibold rounded-full border border-border/50 bg-neutral-100 dark:bg-neutral-900/80 text-foreground appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand shadow-xs hover:border-border transition-colors"
            >
              {sortConfig.options.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-background text-foreground">
                  {opt.label}
                </option>
              ))}
            </select>
            <CaretDownIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          </div>
        )}

        {children}
      </div>
    </div>
  )
}

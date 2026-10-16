"use client"

import { cn } from "@/lib/utils"

export interface FilterChip {
  value: string
  label: string
  count: number
}

/**
 * A row of compact toggle chips for one filter (e.g. status). Pass only
 * chips that have results; "All" is always first. Each chip is a toggle
 * button with aria-pressed; the selected chip is the strong-ink fill
 * (a selected state, so not brand).
 */
export function FilterChips({
  label,
  chips,
  value,
  onChange,
  total,
}: {
  /** Accessible name of the group, e.g. "Filter by status". */
  label: string
  chips: FilterChip[]
  value: string
  onChange: (value: string) => void
  /** Count shown on "All". */
  total: number
}) {
  const all: FilterChip = { value: "all", label: "All", count: total }
  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-wrap items-center gap-1.5"
    >
      {[all, ...chips].map((chip) => {
        const selected = chip.value === value
        return (
          <button
            key={chip.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(chip.value)}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-full border border-transparent px-2.5 text-body font-medium whitespace-nowrap outline-none",
              "transition-[background-color,color,box-shadow,border-color] duration-(--motion-fast) ease-out motion-reduce:transition-none",
              "ui-focus:focus-ring",
              selected
                ? "bg-primary text-primary-foreground"
                : "bg-surface text-fg-default shadow-raised ui-hover:bg-muted"
            )}
          >
            {chip.label}
            <span
              className={cn(
                "text-meta tabular-nums",
                selected ? "text-primary-foreground/80" : "text-fg-muted"
              )}
            >
              {chip.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}

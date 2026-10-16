"use client"

import * as React from "react"
import { Check, ChevronDown } from "@/components/ui/icons"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { IcpSegment } from "./types"

/**
 * One segment in the selection list.
 *
 * Outer row (what decides "pick it or not"): a real checkbox, the segment
 * name, the estimated size labelled as an estimate, and one line of the main
 * pain. Opened (what you check before committing): the full pain point, the
 * qualification criteria and the example companies research found.
 *
 * The checkbox is a native input inside the row's label, so Space toggles it
 * and the whole row is the hit area. The expand button is a sibling, never
 * nested in the label. Selected shows a filled box with a check and a
 * semibold name, never color alone.
 */
export function SegmentRow({
  segment,
  selected,
  onToggle,
}: {
  segment: IcpSegment
  selected: boolean
  onToggle: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const [animate, setAnimate] = React.useState(false)
  const panelId = React.useId()
  const inputId = React.useId()
  const hasMore =
    Boolean(segment.painPoint) || segment.criteria.length > 0 || segment.exampleCompanies.length > 0

  return (
    <li
      className="t-acc border-b border-border last:border-b-0"
      data-open={open || undefined}
      data-animate={animate || undefined}
      data-selected={selected || undefined}
    >
      <div className="flex items-start gap-1 py-1">
        <label
          htmlFor={inputId}
          className="group/seg flex min-w-0 flex-1 cursor-pointer items-start gap-3 rounded-lg px-2 py-2.5 ui-hover:bg-muted has-focus-visible:focus-ring"
        >
          <input
            id={inputId}
            type="checkbox"
            checked={selected}
            onChange={onToggle}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className={cn(
              "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-[background-color,border-color] duration-(--motion-fast) ease-out motion-reduce:transition-none",
              selected ? "border-fg-strong bg-fg-strong text-white" : "border-border-strong bg-surface"
            )}
          >
            {selected && <Check className="size-3 [--icon-stroke:2.5px]" />}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className={cn("text-body text-fg-strong", selected ? "font-semibold" : "font-medium")}>
                {segment.name}
              </span>
              {segment.estimatedSizeLabel && (
                <span className="text-meta text-fg-muted">
                  {segment.estimatedSizeLabel} <span className="font-normal">· estimate</span>
                </span>
              )}
            </span>
            {segment.painPoint && (
              <span className="line-clamp-1 text-body text-fg-muted">{segment.painPoint}</span>
            )}
          </span>
        </label>
        {hasMore && (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={`${open ? "Hide" : "Show"} details for ${segment.name}`}
            onClick={() => {
              setAnimate(true)
              setOpen((o) => !o)
            }}
            className="mt-1.5 flex size-8 shrink-0 items-center justify-center rounded-md text-fg-muted outline-none ui-hover:bg-muted ui-hover:text-fg-strong ui-focus:focus-ring"
          >
            <ChevronDown className="pc-chevron size-4" data-open={open || undefined} />
          </button>
        )}
      </div>

      <div className="t-acc-panel" id={panelId} inert={!open}>
        <div className="t-acc-panel-inner">
          <div className="flex flex-col gap-4 ps-9 pe-11 pb-4">
            {segment.painPoint && (
              <div className="flex flex-col gap-1">
                <h3 className="text-meta text-fg-muted">Main pain</h3>
                <p className="text-body text-fg-default">{segment.painPoint}</p>
              </div>
            )}
            {segment.criteria.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <h3 className="text-meta text-fg-muted">How a company qualifies</h3>
                <ul className="flex flex-wrap gap-1.5">
                  {segment.criteria.map((c, i) => (
                    <li key={i} className="max-w-full">
                      <Badge variant="neutral">{c}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {segment.exampleCompanies.length > 0 && (
              <div className="flex flex-col gap-1">
                <h3 className="text-meta text-fg-muted">Examples research found</h3>
                <p className="text-body text-fg-default">
                  {segment.exampleCompanies.map((ex) => ex.name).join(", ")}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </li>
  )
}

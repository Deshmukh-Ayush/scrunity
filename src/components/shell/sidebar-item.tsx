"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronDown } from "@/components/ui/icons"
import { cn } from "@/lib/utils"

/**
 * Sidebar rows. 32px tall, 6px radius, 16px icon, 14/20 medium label.
 * Hover fills with --muted-fill; the current page is a white chip
 * (shadow-raised) with aria-current="page". Focus is the shared brand ring.
 * ui-hover / ui-focus also match data-force, so the testing route can show
 * every state at once.
 */
export const sidebarItemClassName = cn(
  "group/sidebar-item flex h-8 w-full min-w-0 items-center gap-2 rounded-sm border border-transparent px-2 text-start text-body font-medium text-fg-default outline-none select-none",
  "transition-[background-color,color,box-shadow,border-color] duration-(--motion-fast) ease-out motion-reduce:transition-none",
  "ui-hover:bg-muted ui-hover:text-fg-strong ui-focus:focus-ring",
  "aria-[current=page]:bg-surface aria-[current=page]:text-fg-strong aria-[current=page]:shadow-raised",
  "[&_svg]:size-4 [&_svg]:shrink-0"
)

type SidebarItemProps = Omit<React.ComponentProps<typeof Link>, "children"> & {
  icon?: React.ComponentType<{ className?: string }>
  label: string
  current?: boolean
  "data-force"?: "hover" | "focus-visible"
}

export function SidebarItem({
  icon: Icon,
  label,
  current = false,
  className,
  ...props
}: SidebarItemProps) {
  return (
    <Link
      data-slot="sidebar-item"
      aria-current={current ? "page" : undefined}
      className={cn(sidebarItemClassName, className)}
      {...props}
    >
      {Icon && (
        <Icon className="text-fg-muted group-aria-[current=page]/sidebar-item:text-fg-strong" />
      )}
      <span className="min-w-0 truncate">{label}</span>
    </Link>
  )
}

export function SidebarSectionLabel({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-section-label"
      className={cn(
        "flex h-6 items-center px-2 text-meta text-fg-muted",
        className
      )}
      {...props}
    />
  )
}

/**
 * A collapsible sidebar group: a 12/16 section label as the trigger (button
 * with aria-expanded) and a body that grows with the transitions.dev
 * accordion (grid-template-rows 0fr ↔ 1fr). A closed body is inert, so its
 * links leave the tab order and the accessibility tree.
 */
export function SidebarGroup({
  label,
  open,
  onOpenChange,
  action,
  children,
  "data-force": dataForce,
}: {
  label: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Rendered after the trigger, e.g. a "New chat" icon button. */
  action?: React.ReactNode
  children: React.ReactNode
  "data-force"?: "hover" | "focus-visible"
}) {
  const bodyId = React.useId()
  // Animate only after the first toggle, so restoring a remembered state on load does not play.
  const [animate, setAnimate] = React.useState(false)
  return (
    <div
      data-slot="sidebar-group"
      data-open={open}
      data-animate={animate || undefined}
      className="t-acc"
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => {
            setAnimate(true)
            onOpenChange(!open)
          }}
          data-force={dataForce}
          className={cn(
            "flex h-7 min-w-0 flex-1 items-center gap-1 rounded-sm border border-transparent px-2 text-meta text-fg-muted outline-none",
            "transition-[background-color,color,box-shadow,border-color] duration-(--motion-fast) ease-out motion-reduce:transition-none",
            "ui-hover:text-fg-strong ui-focus:focus-ring"
          )}
        >
          <span className="truncate">{label}</span>
          <span
            aria-hidden="true"
            className={cn(
              "inline-flex transition-transform duration-(--acc-chevron) ease-(--acc-ease) motion-reduce:transition-none",
              !open && "-rotate-90"
            )}
          >
            <ChevronDown className="size-3.5" />
          </span>
        </button>
        {action}
      </div>
      <div id={bodyId} className="t-acc-panel" inert={!open}>
        <div className="t-acc-panel-inner min-h-0">
          <div className="pt-0.5">{children}</div>
        </div>
      </div>
    </div>
  )
}

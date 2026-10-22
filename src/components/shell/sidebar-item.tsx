"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronDown } from "@/components/ui/icons"
import { cn } from "@/lib/utils"

/**
 * Sidebar rows. 32px tall, 6px radius, 16px icon, 14/20 medium label.
 * Hover fills with --muted-fill on rows that are not the current page. Focus
 * is the shared brand ring. ui-hover / ui-focus also match data-force, so the
 * testing route can show every state at once.
 *
 * Current page (aria-current="page"):
 * - tone="nav" (main navigation): solid brand fill with --nav-selected-fg text
 *   and icon (founder decision, see docs/design-system.md "Brand"). The brand
 *   ring would vanish on a brand fill, so focus there is a 2px near-black ring
 *   behind a 2px canvas gap.
 * - tone="list" (chat rows, menu trigger): a white chip with shadow-raised.
 */
export const sidebarItemClassName = cn(
  "group/sidebar-item flex h-8 w-full min-w-0 items-center gap-2 rounded-sm border border-transparent px-2 text-start text-body font-medium text-fg-default outline-none select-none",
  "transition-[background-color,color,box-shadow,border-color] duration-(--motion-fast) ease-out motion-reduce:transition-none",
  "not-aria-[current=page]:ui-hover:bg-muted not-aria-[current=page]:ui-hover:text-fg-strong ui-focus:focus-ring",
  "[&_svg]:size-4 [&_svg]:shrink-0"
)

export const sidebarSelectedClassName = {
  list: "aria-[current=page]:bg-surface aria-[current=page]:text-fg-strong aria-[current=page]:shadow-raised",
  nav: cn(
    "aria-[current=page]:bg-nav-selected aria-[current=page]:text-nav-selected-fg",
    "aria-[current=page]:ui-focus:border-transparent aria-[current=page]:ui-focus:ring-2 aria-[current=page]:ui-focus:ring-fg-strong",
    "aria-[current=page]:ui-focus:ring-offset-2 aria-[current=page]:ui-focus:ring-offset-canvas"
  ),
}

type SidebarItemProps = Omit<React.ComponentProps<typeof Link>, "children"> & {
  icon?: React.ComponentType<{ className?: string }>
  label: string
  current?: boolean
  tone?: "nav" | "list"
  "data-force"?: "hover" | "focus-visible"
}

export function SidebarItem({
  icon: Icon,
  label,
  current = false,
  tone = "list",
  className,
  ...props
}: SidebarItemProps) {
  const iconColor = !current
    ? "text-fg-muted"
    : tone === "nav"
      ? "text-nav-selected-fg"
      : "text-fg-strong"
  return (
    <Link
      data-slot="sidebar-item"
      data-tone={tone}
      aria-current={current ? "page" : undefined}
      className={cn(sidebarItemClassName, sidebarSelectedClassName[tone], className)}
      {...props}
    >
      {Icon && <Icon className={iconColor} />}
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

import * as React from "react"
import Link from "next/link"
import { ArrowRight } from "@/components/ui/icons"
import { cn } from "@/lib/utils"

/**
 * A centered empty (or "nothing yet") message: optional illustration, a bold
 * title, at most two lines of description, actions, and an optional
 * "Learn more" card under it. `size="sm"` drops the illustration spacing for
 * tight places (a list pane, a table). Pass `role="alert"` for errors and
 * `role="status"` when it replaces content after an action.
 */
export function EmptyState({
  illustration,
  title,
  description,
  actions,
  learnMore,
  size = "default",
  role,
  className,
}: {
  illustration?: React.ReactNode
  title: string
  description?: React.ReactNode
  actions?: React.ReactNode
  learnMore?: { title: string; description: string; href: string }
  size?: "default" | "sm"
  role?: "alert" | "status"
  className?: string
}) {
  return (
    <div
      role={role}
      data-slot="empty-state"
      data-size={size}
      className={cn(
        "mx-auto flex w-full max-w-sm flex-col items-center text-center whitespace-normal",
        size === "default" ? "gap-6 py-12" : "gap-3 py-8",
        className
      )}
    >
      {illustration}
      <div className="flex flex-col items-center gap-1">
        <p
          className={cn(
            "text-fg-strong",
            size === "default" ? "text-section font-semibold" : "text-section"
          )}
        >
          {title}
        </p>
        {description && (
          <p className="max-w-xs text-body text-fg-muted">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {actions}
        </div>
      )}
      {learnMore && (
        <Link
          href={learnMore.href}
          className={cn(
            "group/learn mt-2 flex w-full items-center gap-3 rounded-lg border border-transparent bg-surface p-3 text-start shadow-surface outline-none",
            "transition-[box-shadow,border-color] duration-(--motion-fast) ease-out motion-reduce:transition-none",
            "ui-hover:shadow-floating ui-focus:focus-ring"
          )}
        >
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-body font-medium text-fg-strong">
              {learnMore.title}
            </span>
            <span className="text-meta font-normal text-fg-muted">
              {learnMore.description}
            </span>
          </span>
          <ArrowRight
            aria-hidden="true"
            className="size-4 shrink-0 text-fg-muted"
          />
        </Link>
      )}
    </div>
  )
}

import * as React from "react"
import Link from "next/link"
import { ChevronRight } from "@/components/ui/icons"
import { cn } from "@/lib/utils"

/**
 * One Home feed row: a compact white card that is itself the link. Icon,
 * a one-line title, a one-line context line and a trailing slot: an action
 * label for "Needs you" rows, a time for "Today" rows. Long text truncates;
 * the full title is in the tooltip and on the screen the row opens.
 */
export function FeedRow({
  href,
  icon: Icon,
  title,
  context,
  trailing,
  className,
  "data-force": dataForce,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  context?: string
  trailing: React.ReactNode
  className?: string
  "data-force"?: "hover" | "focus-visible" | "pressed"
}) {
  return (
    <Link
      href={href}
      title={title}
      data-force={dataForce}
      className={cn(
        "group/feed-row flex min-h-14 min-w-0 items-center gap-3 rounded-lg border border-transparent bg-surface px-3 py-2.5 shadow-surface outline-none",
        "transition-[box-shadow,translate,border-color,background-color] duration-(--motion-fast) ease-out motion-reduce:transition-none",
        "ui-hover:shadow-floating motion-safe:ui-hover:-translate-y-px ui-focus:focus-ring",
        className
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-fg-default"
      >
        <Icon className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-body font-medium text-fg-strong">
          {title}
        </span>
        {context && (
          <span className="truncate text-meta font-normal text-fg-muted">
            {context}
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-1 text-body text-fg-default">
        {trailing}
        <ChevronRight aria-hidden="true" className="size-4 text-fg-muted" />
      </span>
    </Link>
  )
}

/** Section header above a list of feed rows: 15/22 title, muted count, optional trailing link. */
export function FeedSectionHeader({
  id,
  title,
  meta,
  action,
}: {
  id: string
  title: string
  meta?: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex min-w-0 items-baseline gap-2 px-1">
      <h2 id={id} className="text-section text-fg-default">
        {title}
      </h2>
      {meta !== undefined && (
        <span className="text-meta text-fg-muted tabular-nums">{meta}</span>
      )}
      {action && <span className="ms-auto shrink-0">{action}</span>}
    </div>
  )
}

/** A titled list of feed rows. Renders nothing when there are no rows. */
export function FeedSection({
  id,
  title,
  meta,
  action,
  children,
}: {
  id: string
  title: string
  meta?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode[]
}) {
  if (children.length === 0) return null
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <FeedSectionHeader id={id} title={title} meta={meta} action={action} />
      <ul role="list" className="flex flex-col gap-2">
        {children.map((child, index) => (
          <li key={index}>{child}</li>
        ))}
      </ul>
    </section>
  )
}

"use client"

import * as React from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { useHydrated } from "@/hooks/use-hydrated"
import { cn } from "@/lib/utils"

/**
 * Cell content for DataTable, one component per column type. Cells never wrap:
 * text truncates with an ellipsis and keeps the full value in `title`.
 */

/** Plain text. Set a max width (Tailwind class) so long values truncate. */
export function TextCell({
  value,
  className,
  muted = false,
}: {
  value: string | null | undefined
  className?: string
  muted?: boolean
}) {
  if (!value) return <EmptyValue />
  return (
    <span
      title={value}
      className={cn(
        "block max-w-80 truncate",
        muted && "text-fg-muted",
        className
      )}
    >
      {value}
    </span>
  )
}

/**
 * The row's identity and primary link: a 16px logo (or letter tile) and the
 * name. This is the one focusable link per row; pass the same URL to
 * DataTable's `rowHref` to make the rest of the row clickable with the mouse.
 * Focus shows the shared link ring and tints the row.
 */
export function EntityCell({
  name,
  href,
  imageUrl,
  className,
}: {
  name: string
  href: string
  imageUrl?: string | null
  className?: string
}) {
  return (
    // Narrower on phones, so the next column always peeks in as a cue that the table scrolls.
    <span
      className={cn(
        "flex max-w-72 min-w-0 items-center gap-2 max-md:max-w-44",
        className
      )}
    >
      <EntityTile name={name} imageUrl={imageUrl} />
      <Link
        href={href}
        data-row-link=""
        title={name}
        className={cn(
          // relative: sits above the cell's mouse-only overlay link.
          "relative min-w-0 truncate rounded-sm font-medium text-fg-strong"
        )}
      >
        {name}
      </Link>
    </span>
  )
}

function EntityTile({
  name,
  imageUrl,
}: {
  name: string
  imageUrl?: string | null
}) {
  const [failed, setFailed] = React.useState(false)
  const imgRef = React.useRef<HTMLImageElement>(null)

  // An image that failed before hydration never fires onError for React; catch it here.
  React.useEffect(() => {
    const img = imgRef.current
    if (img && img.complete && img.naturalWidth === 0) setFailed(true)
  }, [imageUrl])

  if (imageUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- 16px logos from many hosts; next/image adds nothing here
      <img
        ref={imgRef}
        src={imageUrl}
        alt=""
        width={16}
        height={16}
        loading="lazy"
        onError={() => setFailed(true)}
        className="size-4 shrink-0 rounded-[4px] object-contain"
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      className="flex size-4 shrink-0 items-center justify-center rounded-[4px] bg-muted text-meta leading-none text-fg-default"
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  )
}

export type StatusTone = "neutral" | "success" | "warning" | "danger"

/** A semantic badge: always a text label, with an optional icon. */
export function StatusCell({
  label,
  tone = "neutral",
  icon,
}: {
  label: string
  tone?: StatusTone
  icon?: React.ReactNode
}) {
  return (
    <Badge variant={tone}>
      {icon}
      {label}
    </Badge>
  )
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

function relativeLabel(date: Date, now: number) {
  const diff = now - date.getTime()
  if (diff < MINUTE) return "Just now"
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d ago`
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

/**
 * A date as <time>. Relative ("3h ago") or absolute ("Oct 16, 2026"); both
 * depend on the viewer's clock and timezone, so until hydration the cell shows
 * a fixed UTC date (server and client markup match). The exact time is in the
 * title.
 */
export function DateCell({
  value,
  mode = "absolute",
}: {
  value: string | Date | null | undefined
  mode?: "relative" | "absolute"
}) {
  const hydrated = useHydrated()
  // Read the clock once per mount (render must stay pure); the label is minutes-precise.
  const [now] = React.useState(() => Date.now())
  if (!value) return <EmptyValue />
  const date = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return <EmptyValue />

  const label = !hydrated
    ? date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : mode === "relative"
      ? relativeLabel(date, now)
      : date.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })

  return (
    <time
      dateTime={date.toISOString()}
      title={hydrated ? date.toLocaleString() : undefined}
      className="text-fg-muted tabular-nums"
    >
      {label}
    </time>
  )
}

/** A right-aligned number. `of` renders "found / target". */
export function NumberCell({
  value,
  of,
}: {
  value: number | null | undefined
  of?: number | null
}) {
  if (value === null || value === undefined) return <EmptyValue />
  return (
    <span className="tabular-nums">
      {value.toLocaleString("en-US")}
      {of !== null && of !== undefined && (
        <span className="text-fg-muted"> / {of.toLocaleString("en-US")}</span>
      )}
    </span>
  )
}

/** Right-aligned controls. Raised above the stretched row link so they stay their own targets. */
export function ActionsCell({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative z-10 inline-flex items-center justify-end gap-2">
      {children}
    </span>
  )
}

/** A value that is not stored or not reached yet. */
function EmptyValue() {
  return (
    <span className="text-fg-muted">
      <span aria-hidden="true">–</span>
      <span className="sr-only">None</span>
    </span>
  )
}

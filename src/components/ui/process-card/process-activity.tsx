"use client"

import * as React from "react"
import { ChevronDown } from "@/components/ui/icons"
import { LocalDate } from "@/components/ui/local-date"

export interface ProcessActivityItem {
  id: string
  /** A plain, real fact derived from stored data: "Found 12 companies". */
  text: string
  /** When it happened, if the data records it. */
  at?: string | null
}

/**
 * A bounded log of real events, oldest first and newest at the bottom. With
 * more than `collapseAfter` lines it starts closed behind "Show details".
 * Open, it shows about six lines and scrolls; it follows new lines only when
 * the reader is already at the bottom. Lines that arrive after the first
 * paint fade and rise in (CSS, reduced-motion safe). Never announced: the
 * card's own live region covers stage changes.
 *
 * With no items it renders nothing. Never pass invented lines.
 */
export function ProcessActivity({
  items,
  collapseAfter = 3,
}: {
  items: ProcessActivityItem[]
  collapseAfter?: number
}) {
  const listId = React.useId()
  const collapsible = items.length > collapseAfter
  const [open, setOpen] = React.useState(false)
  const showList = !collapsible || open

  const listRef = React.useRef<HTMLOListElement>(null)
  const atBottom = React.useRef(true)
  const seen = React.useRef<Set<string> | null>(null)
  const [entered, setEntered] = React.useState<string[]>([])
  const signature = items.map((i) => i.id).join("|")

  // Ids present on first paint never animate; later ones do, once.
  React.useLayoutEffect(() => {
    const ids = signature ? signature.split("|") : []
    if (!seen.current) {
      seen.current = new Set(ids)
      return
    }
    const fresh = ids.filter((id) => !seen.current?.has(id))
    if (fresh.length === 0) return
    fresh.forEach((id) => seen.current?.add(id))
    setEntered((prev) => [...prev, ...fresh])
  }, [signature])

  // Follow new lines only if the reader was already at the bottom.
  React.useLayoutEffect(() => {
    const list = listRef.current
    if (list && atBottom.current) list.scrollTop = list.scrollHeight
  }, [signature, showList])

  if (items.length === 0) return null

  const count = new Intl.PluralRules("en").select(items.length) === "one"
    ? `${items.length} update`
    : `${items.length} updates`

  return (
    <div className="flex flex-col gap-2" data-slot="process-activity">
      <div className="flex items-center justify-between gap-2">
        <span className="text-meta text-fg-muted tabular-nums">{count}</span>
        {collapsible && (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={listId}
            onClick={() => setOpen((o) => !o)}
            className="-me-1.5 inline-flex h-6 items-center gap-1 rounded-sm px-1.5 text-meta text-fg-default outline-none ui-hover:bg-muted ui-focus:focus-ring"
          >
            {open ? "Hide details" : "Show details"}
            <ChevronDown
              className="pc-chevron size-3.5"
              data-open={open || undefined}
            />
          </button>
        )}
      </div>
      {showList && (
        <ol
          id={listId}
          ref={listRef}
          tabIndex={collapsible ? 0 : undefined}
          aria-label="Activity"
          onScroll={(e) => {
            const el = e.currentTarget
            atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 8
          }}
          className="pc-log scrollbar-thin rounded-lg outline-none ui-focus:focus-ring"
        >
          {items.map((item) => (
            <li
              key={item.id}
              data-enter={entered.includes(item.id) || undefined}
              className="pc-log-line text-body"
            >
              <span className="min-w-0 flex-1">{item.text}</span>
              {item.at && (
                <LocalDate
                  value={item.at}
                  kind="time"
                  options={{ hour: "numeric", minute: "2-digit" }}
                  className="shrink-0 text-meta text-fg-muted tabular-nums"
                />
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

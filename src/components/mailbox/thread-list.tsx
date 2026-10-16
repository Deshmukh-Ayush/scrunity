"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Search } from "@/components/ui/icons"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { MAILBOX_FILTERS, type MailboxFilterId } from "@/lib/mailbox-filters"
import type { MailboxThread } from "@/lib/mailbox-thread-types"
import { ThreadRow } from "./thread-row"

/**
 * Left pane: search, the filter (a Select with counts, so six options never
 * clip at 320px and keyboard support comes with it), and the threads as a
 * listbox. Roving focus: one row is tabbable; Arrow keys, Home and End move
 * focus; Enter or Space opens the focused row.
 */
export function ThreadList({
  threads,
  selectedId,
  onOpen,
  search,
  onSearchChange,
  filter,
  onFilterChange,
  counts,
  loading = false,
  onClearFilters,
}: {
  threads: MailboxThread[]
  selectedId: string | null
  onOpen: (id: string) => void
  search: string
  onSearchChange: (value: string) => void
  filter: MailboxFilterId
  onFilterChange: (value: MailboxFilterId) => void
  counts: Record<MailboxFilterId, number>
  loading?: boolean
  onClearFilters: () => void
}) {
  const rowRefs = React.useRef(new Map<string, HTMLLIElement>())
  const [focusedId, setFocusedId] = React.useState<string | null>(null)
  const activeId =
    (focusedId && threads.some((t) => t.id === focusedId) && focusedId) ||
    (selectedId && threads.some((t) => t.id === selectedId) && selectedId) ||
    threads[0]?.id ||
    null

  const moveFocus = (index: number) => {
    const target = threads[Math.max(0, Math.min(threads.length - 1, index))]
    if (!target) return
    setFocusedId(target.id)
    rowRefs.current.get(target.id)?.focus()
  }

  const onRowKeyDown =
    (index: number, id: string) =>
    (event: React.KeyboardEvent<HTMLLIElement>) => {
      if (event.key === "ArrowDown") moveFocus(index + 1)
      else if (event.key === "ArrowUp") moveFocus(index - 1)
      else if (event.key === "Home") moveFocus(0)
      else if (event.key === "End") moveFocus(threads.length - 1)
      else if (event.key === "Enter" || event.key === " ") onOpen(id)
      else return
      event.preventDefault()
    }

  const filtering = search.trim() !== "" || filter !== "all"

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 px-3 pt-3 pb-2">
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-fg-muted"
          />
          <Input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search"
            aria-label="Search conversations"
            className="ps-8"
          />
        </div>
        <Select
          value={filter}
          onValueChange={(value) =>
            typeof value === "string" &&
            onFilterChange(value as MailboxFilterId)
          }
        >
          <SelectTrigger aria-label="Filter conversations" className="shrink-0">
            <SelectValue>
              {(value: string) =>
                MAILBOX_FILTERS.find((f) => f.id === value)?.label ?? "All"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="end" className="min-w-52">
            {MAILBOX_FILTERS.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                <span className="flex w-full items-center justify-between gap-4">
                  {f.label}
                  <span className="text-meta text-fg-muted tabular-nums">
                    {counts[f.id]}
                  </span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="min-h-0 flex-1 px-2 pb-3 md:overflow-y-auto">
        {loading ? (
          <ThreadListSkeleton />
        ) : threads.length === 0 ? (
          filtering ? (
            <EmptyState
              size="sm"
              role="status"
              title="No conversations match"
              description="Try another search or filter."
              actions={
                <Button size="sm" onClick={onClearFilters}>
                  Clear search and filter
                </Button>
              }
            />
          ) : null
        ) : (
          <ul
            role="listbox"
            aria-label="Conversations"
            className="flex flex-col gap-0.5"
          >
            {threads.map((thread, index) => (
              <ThreadRow
                key={thread.id}
                ref={(el) => {
                  if (el) rowRefs.current.set(thread.id, el)
                  else rowRefs.current.delete(thread.id)
                }}
                thread={thread}
                selected={thread.id === selectedId}
                focusable={thread.id === activeId}
                onOpen={() => onOpen(thread.id)}
                onFocus={() => setFocusedId(thread.id)}
                onKeyDown={onRowKeyDown(index, thread.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

/** Placeholder rows while threads load or the first sync runs. */
export function ThreadListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <ul aria-hidden="true" className="flex flex-col gap-0.5">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex flex-col gap-2 px-3 py-3">
          <div className="flex items-center gap-2 ps-4">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="ms-auto h-3 w-10" />
          </div>
          <div className="flex items-center gap-2 ps-4">
            <Skeleton className="h-4 w-16 rounded-sm" />
            <Skeleton className="h-3 w-40" />
          </div>
        </li>
      ))}
    </ul>
  )
}

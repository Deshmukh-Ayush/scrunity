"use client"

import { useId, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { ChevronDown, Search } from "@/components/ui/icons"
import { cn } from "@/lib/utils"
import type { ShowcaseEntry } from "../registry/types"

const PAGE_SIZE = 10

/**
 * Searchable component dropdown (WAI-ARIA combobox + listbox). Shows ten
 * matches at a time; typing filters by name or group.
 */
export function ComponentPicker({
  entries,
  selectedId,
  onSelect,
}: {
  entries: ShowcaseEntry[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(0)
  const [active, setActive] = useState(0)

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return entries
    return entries.filter((e) => e.name.toLowerCase().includes(q) || e.group.toLowerCase().includes(q))
  }, [entries, query])

  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE))
  const visible = matches.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
  const selected = entries.find((e) => e.id === selectedId)

  function choose(entry: ShowcaseEntry) {
    onSelect(entry.id)
    setOpen(false)
    setQuery("")
    setPage(0)
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setOpen(true)
      setActive((i) => Math.min(i + 1, visible.length - 1))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (event.key === "Enter" && open && visible[active]) {
      event.preventDefault()
      choose(visible[active])
    } else if (event.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <div className="relative w-full max-w-xs">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-fg-muted" />
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && visible[active] ? `${listId}-${visible[active].id}` : undefined}
          aria-label="Component"
          placeholder={selected ? selected.name : "Search components"}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setPage(0)
            setActive(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className="h-8 w-full rounded-md bg-surface pr-8 pl-8 text-base text-fg-strong shadow-raised outline-none placeholder:text-fg-default focus-visible:ring-2 focus-visible:ring-[var(--brand)] md:text-sm"
        />
        <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-fg-muted" />
      </div>

      {open && (
        <div
          className="absolute top-full right-0 left-0 z-50 mt-1 rounded-lg bg-popover p-1 shadow-floating"
          // Keep focus in the input while clicking options or paging.
          onMouseDown={(e) => e.preventDefault()}
        >
          <ul id={listId} role="listbox" aria-label="Components">
            {visible.length === 0 && <li className="px-2 py-1.5 text-body text-fg-muted">No components match.</li>}
            {visible.map((entry, index) => (
              <li
                key={entry.id}
                id={`${listId}-${entry.id}`}
                role="option"
                aria-selected={entry.id === selectedId}
                onClick={() => choose(entry)}
                onMouseEnter={() => setActive(index)}
                className={cn(
                  "flex min-h-7 cursor-default items-center justify-between gap-2 rounded-sm px-2 py-1 text-body text-fg-default",
                  index === active && "bg-muted text-fg-strong"
                )}
              >
                <span className={cn(entry.id === selectedId && "font-medium")}>{entry.name}</span>
                <span className="text-meta text-fg-muted">{entry.group}</span>
              </li>
            ))}
          </ul>
          {pageCount > 1 && (
            <div className="mt-1 flex items-center justify-between border-t px-1 pt-1">
              <span className="text-meta text-fg-muted tabular-nums">
                {page * PAGE_SIZE + 1}–{Math.min(matches.length, (page + 1) * PAGE_SIZE)} of {matches.length}
              </span>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={page >= pageCount - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

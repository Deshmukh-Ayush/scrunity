"use client"

import { useId, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { ChevronDown, Search } from "@/components/ui/icons"
import { cn } from "@/lib/utils"
import type { ShowcaseEntry } from "../registry/types"

const PAGE_SIZE = 10

/**
 * Searchable component dropdown (WAI-ARIA combobox + listbox), ten matches
 * per page. The input shows the selected component; typing replaces it and
 * filters by name or group. Keyboard: ArrowDown/ArrowUp move through the
 * list and across page boundaries, PageDown/PageUp change page, Enter picks,
 * Escape closes. Tabbing to Previous/Next keeps the list open.
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
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  // null = not typing: the input shows the selected component's name.
  const [query, setQuery] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [active, setActive] = useState(0)

  const matches = useMemo(() => {
    const q = (query ?? "").trim().toLowerCase()
    if (!q) return entries
    return entries.filter((e) => e.name.toLowerCase().includes(q) || e.group.toLowerCase().includes(q))
  }, [entries, query])

  const pageCount = Math.max(1, Math.ceil(matches.length / PAGE_SIZE))
  const visible = matches.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
  const selected = entries.find((e) => e.id === selectedId)

  function goToPage(next: number, activeIndex: "first" | "last") {
    const target = Math.min(Math.max(next, 0), pageCount - 1)
    setPage(target)
    const size = matches.slice(target * PAGE_SIZE, target * PAGE_SIZE + PAGE_SIZE).length
    setActive(activeIndex === "first" ? 0 : Math.max(size - 1, 0))
  }

  function choose(entry: ShowcaseEntry) {
    onSelect(entry.id)
    setOpen(false)
    setQuery(null)
    setPage(0)
  }

  /** Close only when focus leaves the whole picker (input, list and pager). */
  function onBlurWithin(event: React.FocusEvent) {
    if (!rootRef.current?.contains(event.relatedTarget as Node | null)) {
      setOpen(false)
      setQuery(null)
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault()
        if (!open) return setOpen(true)
        if (active < visible.length - 1) setActive(active + 1)
        else if (page < pageCount - 1) goToPage(page + 1, "first")
        break
      case "ArrowUp":
        event.preventDefault()
        if (active > 0) setActive(active - 1)
        else if (page > 0) goToPage(page - 1, "last")
        break
      case "PageDown":
        event.preventDefault()
        setOpen(true)
        goToPage(page + 1, "first")
        break
      case "PageUp":
        event.preventDefault()
        setOpen(true)
        goToPage(page - 1, "first")
        break
      case "Enter":
        if (open && visible[active]) {
          event.preventDefault()
          choose(visible[active])
        }
        break
      case "Escape":
        setOpen(false)
        setQuery(null)
        break
    }
  }

  return (
    <div ref={rootRef} className="relative w-full max-w-xs" onBlur={onBlurWithin}>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-fg-muted" />
        <input
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && visible[active] ? `${listId}-${visible[active].id}` : undefined}
          aria-label="Component"
          placeholder="Search components"
          value={query ?? selected?.name ?? ""}
          onChange={(e) => {
            setQuery(e.target.value)
            setPage(0)
            setActive(0)
            setOpen(true)
          }}
          onFocus={(e) => {
            e.target.select()
            setOpen(true)
          }}
          onKeyDown={onKeyDown}
          className="h-8 w-full rounded-md border border-transparent bg-surface pr-8 pl-8 text-base text-fg-strong shadow-raised transition-[border-color,box-shadow] duration-150 ease-out outline-none placeholder:text-fg-subtle focus-visible:focus-ring motion-reduce:transition-none md:text-sm"
        />
        <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-fg-muted" />
      </div>

      {open && (
        <div className="absolute top-full right-0 left-0 z-50 mt-1 rounded-lg border border-transparent bg-popover p-1 shadow-floating">
          <ul id={listId} role="listbox" aria-label="Components">
            {visible.length === 0 && <li className="px-2 py-1.5 text-body text-fg-muted">No components match.</li>}
            {visible.map((entry, index) => (
              <li
                key={entry.id}
                id={`${listId}-${entry.id}`}
                role="option"
                aria-selected={entry.id === selectedId}
                // Keep focus in the input while clicking an option.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(entry)}
                onMouseEnter={() => setActive(index)}
                className={cn(
                  "flex min-h-7 cursor-default items-center justify-between gap-2 rounded-[5px] px-2 py-1 text-body text-fg-default",
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
              <span className="text-meta text-fg-muted tabular-nums" aria-live="polite">
                {page * PAGE_SIZE + 1}–{Math.min(matches.length, (page + 1) * PAGE_SIZE)} of {matches.length}
              </span>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => goToPage(page - 1, "first")}>
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={page >= pageCount - 1}
                  onClick={() => goToPage(page + 1, "first")}
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

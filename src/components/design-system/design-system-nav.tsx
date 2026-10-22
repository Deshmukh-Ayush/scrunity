"use client"

import * as React from "react"
import { Search } from "@/components/ui/icons"
import { SidebarGroup, sidebarItemClassName, sidebarSelectedClassName } from "@/components/shell/sidebar-item"
import type { ShowcaseEntry, ShowcaseGroup } from "@/components/playground/registry/types"
import { cn } from "@/lib/utils"

/** Entries grouped by `group`, groups in the order they first appear in the registry. */
function groupEntries(entries: ShowcaseEntry[]) {
  const groups = new Map<ShowcaseGroup, ShowcaseEntry[]>()
  for (const entry of entries) {
    groups.set(entry.group, [...(groups.get(entry.group) ?? []), entry])
  }
  return [...groups.entries()]
}

/**
 * Sidebar contents for /design-system: a filter field, then one collapsible
 * SidebarGroup per showcase group with a row per component. Rows are links
 * to #<id>, so they open in a new tab and copy like any link; a plain click
 * selects in place. While filtering, every group with a match is shown open.
 */
export function DesignSystemNav({
  entries,
  selectedId,
  onSelect,
}: {
  entries: ShowcaseEntry[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  const [query, setQuery] = React.useState("")
  const [closed, setClosed] = React.useState<ReadonlySet<ShowcaseGroup>>(new Set())

  const q = query.trim().toLowerCase()
  const matches = q
    ? entries.filter((e) => e.name.toLowerCase().includes(q) || e.group.toLowerCase().includes(q))
    : entries
  const groups = groupEntries(matches)

  function setGroupOpen(group: ShowcaseGroup, open: boolean) {
    setClosed((previous) => {
      const next = new Set(previous)
      if (open) next.delete(group)
      else next.add(group)
      return next
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-3 pt-3 pb-2">
        <div className="flex flex-col px-2 pb-3">
          <span className="text-body font-medium text-fg-strong">Scrunity</span>
          <span className="text-meta text-fg-muted">Design system</span>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-fg-muted" />
          <input
            type="search"
            aria-label="Filter components"
            placeholder="Filter components"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 w-full rounded-md border border-transparent bg-surface pr-2 pl-8 text-base text-fg-strong shadow-raised transition-[border-color,box-shadow] duration-150 ease-out outline-none placeholder:text-fg-subtle focus-visible:focus-ring motion-reduce:transition-none md:text-sm"
          />
        </div>
      </div>

      <nav aria-label="Components" className="flex min-h-0 flex-1 scrollbar-thin flex-col gap-3 overflow-y-auto px-3 pt-2 pb-4">
        {groups.length === 0 && <p className="px-2 text-body text-fg-muted">No components match.</p>}
        {groups.map(([group, groupItems]) => (
          <SidebarGroup
            key={group}
            label={group}
            open={q !== "" || !closed.has(group)}
            onOpenChange={(open) => setGroupOpen(group, open)}
          >
            <ul role="list" className="flex flex-col gap-px">
              {groupItems.map((entry) => (
                <li key={entry.id}>
                  <a
                    href={`#${entry.id}`}
                    aria-current={entry.id === selectedId ? "page" : undefined}
                    onClick={(event) => {
                      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
                      event.preventDefault()
                      onSelect(entry.id)
                    }}
                    className={cn(sidebarItemClassName, sidebarSelectedClassName.list, "font-normal")}
                  >
                    <span className="min-w-0 truncate">{entry.name}</span>
                  </a>
                </li>
              ))}
            </ul>
          </SidebarGroup>
        ))}
      </nav>

      <p className="shrink-0 px-5 pt-2 pb-3 text-meta text-fg-subtle tabular-nums" aria-live="polite">
        {q ? `${matches.length} of ${entries.length} components` : `${entries.length} components`}
      </p>
    </div>
  )
}

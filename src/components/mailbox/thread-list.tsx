"use client"

import { AlertTriangle, Inbox, RefreshCw, Search } from "@/components/ui/icons"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { MailboxThread } from "@/lib/mailbox-thread-types"
import { IntentBadge } from "./intent-badge"
import { ThreadTimestamp } from "./mailbox-time"

const FILTERS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "bounced", label: "Bounced" },
  { id: "interested", label: "Interested" },
  { id: "question", label: "Questions" },
  { id: "not_interested", label: "Not Interested" },
]

function ThreadRow({
  thread,
  isSelected,
  onSelect,
}: {
  thread: MailboxThread
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={isSelected || undefined}
        data-selected={isSelected || undefined}
        className={cn(
          "relative flex w-full cursor-pointer flex-col gap-1.5 p-3.5 text-left transition-colors select-none",
          "hover:bg-muted/40 data-[selected]:border-l-2 data-[selected]:border-l-primary data-[selected]:bg-primary/10 data-[selected]:shadow-2xs dark:data-[selected]:bg-primary/15"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            {thread.isUnread && (
              <span
                className="size-2 shrink-0 rounded-full bg-primary"
                title="Unread response"
              />
            )}
            <span
              className={cn(
                "truncate text-xs text-foreground",
                thread.isUnread || isSelected ? "font-semibold" : "font-medium"
              )}
            >
              {thread.contact.name}
            </span>
            {thread.company.name && (
              <span className="hidden truncate text-[11px] text-muted-foreground sm:inline">
                • {thread.company.name}
              </span>
            )}
          </div>
          <span className="shrink-0 font-mono text-[10px] whitespace-nowrap text-muted-foreground">
            <ThreadTimestamp value={thread.lastActivityAt} />
          </span>
        </div>

        <div className="truncate text-xs font-medium text-foreground/90">
          {thread.subject}
        </div>
        <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
          {thread.latestSnippet}
        </p>

        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          <Badge
            variant="neutral"
            className="max-w-[140px] truncate border-border/80 px-1.5 py-0 text-muted-foreground">
            {thread.campaign.name}
          </Badge>
          {thread.isBounced && (
            <Badge
              variant="danger"
              className="gap-1 px-1.5 py-0">
              <AlertTriangle className="size-2.5" />
              Bounced
            </Badge>
          )}
          <IntentBadge intent={thread.classifiedIntent} />
        </div>
      </button>
    </li>
  )
}

/** Searchable, filterable list of outreach threads (left pane). */
export function ThreadList({
  threads,
  selectedThreadId,
  onSelect,
  searchQuery,
  onSearchChange,
  intentFilter,
  onIntentFilterChange,
  isLoading,
}: {
  threads: MailboxThread[]
  selectedThreadId: string | null
  onSelect: (threadId: string) => void
  searchQuery: string
  onSearchChange: (query: string) => void
  intentFilter: string
  onIntentFilterChange: (filter: string) => void
  isLoading: boolean
}) {
  return (
    <div className="flex min-h-0 w-full flex-col border-r border-border/70 bg-card/40 sm:w-80 md:w-96">
      <div className="space-y-2.5 border-b border-border/70 bg-background/50 p-3">
        <div className="relative">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search contacts, subjects..."
            aria-label="Search threads"
            className="h-8 border-border/80 bg-muted/40 pl-8 text-xs focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>

        <div
          role="group"
          aria-label="Filter threads"
          className="hide-scrollbar flex items-center gap-1 overflow-x-auto pb-0.5 text-[11px]"
        >
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onIntentFilterChange(f.id)}
              aria-pressed={intentFilter === f.id}
              className={cn(
                "rounded-full px-2 py-0.5 font-medium whitespace-nowrap transition-colors",
                "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                "aria-pressed:bg-primary aria-pressed:font-semibold aria-pressed:text-primary-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-2 p-6 text-center">
            <RefreshCw className="mx-auto size-4 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">
              Loading mailbox threads...
            </p>
          </div>
        ) : threads.length === 0 ? (
          <div className="space-y-3 p-8 text-center">
            <div className="mx-auto flex size-10 items-center justify-center rounded-full border border-border/60 bg-muted/50 text-muted-foreground">
              <Inbox className="size-5" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">
                No conversations found
              </p>
              <p className="text-[11px] text-muted-foreground">
                {searchQuery
                  ? "No threads match your search query."
                  : "Approved emails sent through campaigns will appear here once dispatched."}
              </p>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-border/50">
            {threads.map((thread) => (
              <ThreadRow
                key={thread.id}
                thread={thread}
                isSelected={selectedThreadId === thread.id}
                onSelect={() => onSelect(thread.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

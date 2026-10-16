"use client"

import * as React from "react"
import {
  MAILBOX_FILTERS,
  matchesFilter,
  matchesSearch,
  type MailboxFilterId,
} from "@/lib/mailbox-filters"
import type { MailboxThread } from "@/lib/mailbox-thread-types"
import { cn } from "@/lib/utils"
import { MailboxHeader } from "./mailbox-header"
import {
  CONNECT_GMAIL_HREF,
  MailboxAttentionBanner,
  MailboxNoConversations,
  MailboxNotConnected,
  MailboxSyncing,
} from "./mailbox-states"
import { ThreadList } from "./thread-list"
import { ThreadPane, ThreadPanePlaceholder } from "./thread-pane"
import type { MailboxTab } from "./types"

/** Where the mailbox connection stands. "syncing" has no backend signal yet (testing route only). */
export type MailboxConnection =
  | { state: "not-connected" }
  | { state: "syncing"; email: string; finished?: boolean }
  | { state: "connected"; email: string }
  | {
      state: "attention"
      email: string
      reason?: "revoked" | "sync-error"
      provider?: string
    }

/**
 * The Mailbox page, presentational: everything arrives as props, so the page
 * and the testing route's fixtures render the same component. Desktop: list
 * (~380px) and thread side by side. Phones: the list, or the open thread
 * with a back button.
 */
export function MailboxView({
  tab,
  tabHrefs,
  connection,
  threads,
  openThreadId,
  search,
  onSearchChange,
  filter,
  onFilterChange,
  onOpen,
  onBack,
  loading = false,
  refreshing = false,
  onRefresh,
  focusThreadOnOpen = false,
  settings,
}: {
  tab: MailboxTab
  tabHrefs: Record<MailboxTab, string>
  connection: MailboxConnection
  threads: MailboxThread[]
  /** From ?thread=. Without one, desktop shows the newest thread and phones show the list. */
  openThreadId: string | null
  search: string
  onSearchChange: (value: string) => void
  filter: MailboxFilterId
  onFilterChange: (value: MailboxFilterId) => void
  onOpen: (id: string) => void
  onBack: () => void
  loading?: boolean
  refreshing?: boolean
  onRefresh?: () => void
  focusThreadOnOpen?: boolean
  settings: React.ReactNode
}) {
  const searched = React.useMemo(
    () => threads.filter((t) => matchesSearch(t, search)),
    [threads, search]
  )
  const visible = React.useMemo(
    () => searched.filter((t) => matchesFilter(t, filter)),
    [searched, filter]
  )
  const counts = React.useMemo(
    () =>
      Object.fromEntries(
        MAILBOX_FILTERS.map((f) => [
          f.id,
          searched.filter((t) => matchesFilter(t, f.id)).length,
        ])
      ) as Record<MailboxFilterId, number>,
    [searched]
  )

  const urlThread = openThreadId
    ? (threads.find((t) => t.id === openThreadId) ?? null)
    : null
  const shownThread = urlThread ?? visible[0] ?? null

  let body: React.ReactNode
  if (tab === "settings") {
    body = (
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-6">
        {settings}
      </div>
    )
  } else if (connection.state === "not-connected") {
    body = <MailboxNotConnected settingsHref={tabHrefs.settings} />
  } else if (connection.state === "syncing") {
    body = (
      <MailboxSyncing email={connection.email} finished={connection.finished} />
    )
  } else if (!loading && threads.length === 0) {
    body = <MailboxNoConversations />
  } else {
    body = (
      <div className="flex min-h-0 flex-1">
        <div
          className={cn(
            "min-h-0 w-full flex-col md:flex md:w-[380px] md:shrink-0 md:border-e md:border-border",
            urlThread ? "hidden" : "flex"
          )}
        >
          <ThreadList
            threads={visible}
            selectedId={shownThread?.id ?? null}
            onOpen={onOpen}
            search={search}
            onSearchChange={onSearchChange}
            filter={filter}
            onFilterChange={onFilterChange}
            counts={counts}
            loading={loading}
            onClearFilters={() => {
              onSearchChange("")
              onFilterChange("all")
            }}
          />
        </div>
        <div
          className={cn(
            "min-h-0 min-w-0 flex-1 flex-col",
            urlThread ? "flex" : "hidden md:flex"
          )}
        >
          {shownThread ? (
            <ThreadPane
              key={shownThread.id}
              thread={shownThread}
              onBack={urlThread ? onBack : undefined}
              focusOnOpen={Boolean(urlThread) && focusThreadOnOpen}
            />
          ) : (
            <ThreadPanePlaceholder />
          )}
        </div>
      </div>
    )
  }

  // Desktop: fixed height, list and thread scroll on their own. Phones: one page that scrolls.
  return (
    <div className="flex min-h-full flex-col md:h-full md:min-h-0">
      <MailboxHeader
        activeTab={tab}
        hrefs={tabHrefs}
        threadCount={
          connection.state === "not-connected" ? null : threads.length
        }
        statusText={statusLine(connection)}
        refreshing={refreshing}
        onRefresh={connection.state === "not-connected" ? undefined : onRefresh}
      />
      {connection.state === "attention" && tab === "conversations" && (
        <MailboxAttentionBanner
          email={connection.email}
          reason={connection.reason}
          reconnectHref={
            !connection.provider || connection.provider === "gmail"
              ? CONNECT_GMAIL_HREF
              : tabHrefs.settings
          }
        />
      )}
      {body}
    </div>
  )
}

function statusLine(connection: MailboxConnection) {
  switch (connection.state) {
    case "not-connected":
      return "No mailbox connected."
    case "syncing":
      return `Connected as ${connection.email}. Checking for replies now.`
    case "attention":
      return `${connection.email} needs reconnecting.`
    case "connected":
      return `Sending from ${connection.email}. Replies are checked about every 10 minutes.`
  }
}

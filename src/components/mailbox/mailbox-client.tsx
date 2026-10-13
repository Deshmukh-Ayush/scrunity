"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import type { MailboxThread } from "@/lib/mailbox-thread-types"
import { MailboxHeader } from "./mailbox-header"
import { MailboxSettings } from "./mailbox-settings"
import { ThreadDetail } from "./thread-detail"
import { ThreadList } from "./thread-list"
import type { ConnectedMailboxInfo, MailboxTab } from "./types"

/**
 * Keeps the current selection if it still exists, otherwise prefers the thread
 * the URL points at (?contactId= or ?threadId=), then the newest thread.
 */
function pickSelectedThread(
  threads: MailboxThread[],
  previous: string | null,
  target: { contactId: string | null; threadId: string | null }
) {
  if (target.contactId) {
    const match = threads.find((t) => t.contact.id === target.contactId)
    if (match) return match.id
  }
  if (target.threadId) {
    const match = threads.find(
      (t) => t.id === target.threadId || t.threadId === target.threadId || t.draftId === target.threadId
    )
    if (match) return match.id
  }
  if (previous && threads.some((t) => t.id === previous)) return previous
  return threads[0]?.id || null
}

/**
 * Mailbox page body. Renders server-fetched threads immediately; the list is
 * re-queried when the search or filter changes, on refresh, and after
 * connecting or disconnecting a mailbox.
 */
export function MailboxClient({
  initialThreads,
  initialMailbox,
}: {
  initialThreads: MailboxThread[]
  initialMailbox: ConnectedMailboxInfo | null
}) {
  const searchParams = useSearchParams()
  const target = {
    contactId: searchParams?.get("contactId") ?? null,
    threadId: searchParams?.get("threadId") ?? null,
  }
  const tabParam = searchParams?.get("tab")

  const [activeTab, setActiveTab] = React.useState<MailboxTab>(
    tabParam === "settings" ? "settings" : "conversations"
  )
  const [threads, setThreads] = React.useState(initialThreads)
  const [mailbox, setMailbox] = React.useState(initialMailbox)
  const [selectedThreadId, setSelectedThreadId] = React.useState(() =>
    pickSelectedThread(initialThreads, null, target)
  )
  const [searchQuery, setSearchQuery] = React.useState("")
  const [intentFilter, setIntentFilter] = React.useState("all")
  const [isLoading, setIsLoading] = React.useState(false)
  const [isRefreshing, setIsRefreshing] = React.useState(false)

  // Follow ?tab= when the sidebar or a redirect changes it.
  React.useEffect(() => {
    if (tabParam === "settings" || tabParam === "conversations") setActiveTab(tabParam)
  }, [tabParam])

  const loadThreads = React.useCallback(
    async (mode: "replace" | "refresh" = "replace") => {
      if (mode === "refresh") setIsRefreshing(true)
      else setIsLoading(true)
      try {
        const params = new URLSearchParams()
        if (searchQuery) params.set("search", searchQuery)
        if (intentFilter !== "all") params.set("intent", intentFilter)

        const res = await fetch(`/api/gtm/mailbox/threads?${params.toString()}`)
        if (!res.ok) throw new Error("Failed to load threads")
        const data = await res.json()
        const nextThreads: MailboxThread[] = data.threads || []

        setThreads(nextThreads)
        setMailbox(data.mailbox || null)
        setSelectedThreadId((prev) => pickSelectedThread(nextThreads, prev, target))
      } catch (err) {
        console.error("[MailboxClient] Load error:", err)
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    // target is derived from the URL; re-reading it on each load is intended.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchQuery, intentFilter]
  )

  // The server already rendered the unfiltered list, so skip the first run and
  // only re-query when the search or filter actually changes.
  const hasMounted = React.useRef(false)
  React.useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true
      return
    }
    loadThreads()
  }, [loadThreads])

  const handleDisconnect = async () => {
    if (!confirm("Disconnect this mailbox? Outgoing email sends will pause until reconnected.")) {
      return
    }
    await fetch("/api/gtm/mailbox", { method: "DELETE" })
    await loadThreads()
  }

  const selectedThread = threads.find((t) => t.id === selectedThreadId) || threads[0] || null

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background text-foreground">
      <MailboxHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        threadCount={threads.length}
        unreadCount={threads.filter((t) => t.isUnread).length}
        isRefreshing={isRefreshing}
        onRefresh={() => loadThreads("refresh")}
      />

      {activeTab === "settings" ? (
        <MailboxSettings
          mailbox={mailbox}
          callbackConnected={Boolean(searchParams?.get("mailbox_connected"))}
          callbackError={searchParams?.get("error") ?? null}
          onDisconnect={handleDisconnect}
          onConnected={() => loadThreads()}
        />
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <ThreadList
            threads={threads}
            selectedThreadId={selectedThread?.id ?? null}
            onSelect={setSelectedThreadId}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            intentFilter={intentFilter}
            onIntentFilterChange={setIntentFilter}
            isLoading={isLoading}
          />
          <ThreadDetail thread={selectedThread} />
        </div>
      )}
    </div>
  )
}

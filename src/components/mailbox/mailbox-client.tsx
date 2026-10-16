"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useUrlFilter } from "@/components/ui/data-table/use-url-filter"
import { MAILBOX_FILTERS } from "@/lib/mailbox-filters"
import type { MailboxThread } from "@/lib/mailbox-thread-types"
import { MailboxSettings } from "./mailbox-settings"
import { MailboxView, type MailboxConnection } from "./mailbox-view"
import type { ConnectedMailboxInfo, MailboxTab } from "./types"

const FILTER_IDS = MAILBOX_FILTERS.map((f) => f.id)

/** Older deep links (?contactId=, ?threadId=, used by Home and Leads) point at a thread too. */
function resolveLegacyTarget(
  threads: MailboxThread[],
  contactId: string | null,
  threadId: string | null
) {
  if (contactId)
    return threads.find((t) => t.contact.id === contactId)?.id ?? null
  if (threadId)
    return (
      threads.find(
        (t) =>
          t.id === threadId || t.threadId === threadId || t.draftId === threadId
      )?.id ?? null
    )
  return null
}

function connectionOf(mailbox: ConnectedMailboxInfo | null): MailboxConnection {
  if (!mailbox) return { state: "not-connected" }
  if (mailbox.status !== "connected")
    return {
      state: "attention",
      email: mailbox.email,
      reason: "revoked",
      provider: mailbox.provider,
    }
  return { state: "connected", email: mailbox.email }
}

/**
 * Mailbox page state: the threads (server-rendered, refreshed on demand), the
 * open thread in ?thread=, the filter in ?filter=, the tab in ?tab=. Search
 * and filter run on the loaded list with the same predicates as the API
 * (lib/mailbox-filters.ts), so counts are instant.
 */
export function MailboxClient({
  initialThreads,
  initialMailbox,
}: {
  initialThreads: MailboxThread[]
  initialMailbox: ConnectedMailboxInfo | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [threads, setThreads] = React.useState(initialThreads)
  const [mailbox, setMailbox] = React.useState(initialMailbox)
  const [search, setSearch] = React.useState("")
  const [refreshing, setRefreshing] = React.useState(false)
  const [filter, setFilter] = useUrlFilter("filter", FILTER_IDS)
  // Set when a thread is opened on a narrow screen, so focus moves into it.
  const [focusThread, setFocusThread] = React.useState(false)
  const openedFromList = React.useRef(false)
  const lastOpenedId = React.useRef<string | null>(null)

  const tab: MailboxTab =
    searchParams.get("tab") === "settings" ? "settings" : "conversations"
  const openThreadId = searchParams.get("thread")

  const hrefWith = React.useCallback(
    (changes: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(changes)) {
        if (value === null) params.delete(key)
        else params.set(key, value)
      }
      const query = params.toString()
      return query ? `${pathname}?${query}` : pathname
    },
    [pathname, searchParams]
  )

  // Translate an old deep link into ?thread= once.
  const legacy = resolveLegacyTarget(
    threads,
    searchParams.get("contactId"),
    searchParams.get("threadId")
  )
  React.useEffect(() => {
    if (searchParams.get("contactId") || searchParams.get("threadId"))
      router.replace(
        hrefWith({ contactId: null, threadId: null, thread: legacy }),
        { scroll: false }
      )
  }, [legacy, hrefWith, router, searchParams])

  // Back on phones: return focus to the row that was open.
  React.useEffect(() => {
    if (openThreadId || !lastOpenedId.current) return
    document.getElementById(`thread-${lastOpenedId.current}`)?.focus()
  }, [openThreadId])

  const openThread = (id: string) => {
    lastOpenedId.current = id
    openedFromList.current = true
    setFocusThread(window.matchMedia("(max-width: 767px)").matches)
    router.push(hrefWith({ thread: id }), { scroll: false })
  }

  const back = () => {
    // Opened from the list in this tab: undo that step. Opened from a shared link: go to the list.
    if (openedFromList.current) {
      openedFromList.current = false
      router.back()
    } else {
      router.replace(hrefWith({ thread: null }), { scroll: false })
    }
  }

  const refresh = async () => {
    setRefreshing(true)
    try {
      const res = await fetch("/api/gtm/mailbox/threads")
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setThreads(data.threads || [])
      setMailbox(data.mailbox || null)
    } catch (err) {
      console.error("[Mailbox] refresh failed:", err)
    } finally {
      setRefreshing(false)
    }
  }

  const disconnect = async () => {
    if (
      !confirm(
        "Disconnect this mailbox? Outgoing email sends will pause until reconnected."
      )
    )
      return
    await fetch("/api/gtm/mailbox", { method: "DELETE" })
    await refresh()
  }

  return (
    <MailboxView
      tab={tab}
      tabHrefs={{
        conversations: hrefWith({ tab: null }),
        settings: hrefWith({ tab: "settings", thread: null }),
      }}
      connection={connectionOf(mailbox)}
      threads={threads}
      openThreadId={openThreadId}
      search={search}
      onSearchChange={setSearch}
      filter={filter}
      onFilterChange={setFilter}
      onOpen={openThread}
      onBack={back}
      refreshing={refreshing}
      onRefresh={refresh}
      focusThreadOnOpen={focusThread}
      settings={
        <MailboxSettings
          mailbox={mailbox}
          callbackConnected={Boolean(searchParams.get("mailbox_connected"))}
          callbackError={searchParams.get("error") ?? null}
          onDisconnect={disconnect}
          onConnected={refresh}
        />
      }
    />
  )
}

"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "@/components/ui/icons"
import { cn } from "@/lib/utils"
import type { MailboxTab } from "./types"

/**
 * Utility header: title, the connected address and how replies arrive (plain
 * text), Refresh, and the Conversations / Settings tabs. The tabs are links
 * (?tab=), so each view has a URL; the current one has aria-current="page".
 */
export function MailboxHeader({
  activeTab,
  hrefs,
  threadCount,
  statusText,
  refreshing,
  onRefresh,
}: {
  activeTab: MailboxTab
  hrefs: Record<MailboxTab, string>
  threadCount: number | null
  /** One plain sentence about the connection. */
  statusText: string
  refreshing: boolean
  onRefresh?: () => void
}) {
  const tabs: { id: MailboxTab; label: string; count?: number | null }[] = [
    { id: "conversations", label: "Conversations", count: threadCount },
    { id: "settings", label: "Settings" },
  ]

  return (
    <header className="flex shrink-0 flex-col gap-3 border-b border-border px-4 pt-5 md:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-title text-fg-strong">Mailbox</h1>
          <p className="text-body break-words text-fg-muted">{statusText}</p>
        </div>
        {onRefresh && (
          <Button onClick={onRefresh} loading={refreshing}>
            <RefreshCw data-icon="inline-start" />
            Refresh
          </Button>
        )}
      </div>
      <nav aria-label="Mailbox sections" className="-mb-px flex gap-4">
        {tabs.map((tab) => {
          const current = tab.id === activeTab
          return (
            <Link
              key={tab.id}
              href={hrefs[tab.id]}
              aria-current={current ? "page" : undefined}
              scroll={false}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 border-b-2 text-body font-medium outline-none",
                "transition-[color,border-color] duration-(--motion-fast) ease-out motion-reduce:transition-none",
                "focus-visible:rounded-sm",
                current
                  ? "border-fg-strong text-fg-strong"
                  : "border-transparent text-fg-muted hover:text-fg-strong"
              )}
            >
              {tab.label}
              {tab.count !== undefined && tab.count !== null && (
                <span className="text-meta text-fg-muted tabular-nums">
                  {tab.count}
                </span>
              )}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}

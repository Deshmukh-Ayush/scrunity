"use client"

import { Mail, RefreshCw } from "@/components/ui/icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { MailboxTab } from "./types"

/** Page title with unread count, the Conversations/Settings switch, and refresh. */
export function MailboxHeader({
  activeTab,
  onTabChange,
  threadCount,
  unreadCount,
  isRefreshing,
  onRefresh,
}: {
  activeTab: MailboxTab
  onTabChange: (tab: MailboxTab) => void
  threadCount: number
  unreadCount: number
  isRefreshing: boolean
  onRefresh: () => void
}) {
  const tabs: Array<{ id: MailboxTab; label: string }> = [
    { id: "conversations", label: `Conversations (${threadCount})` },
    { id: "settings", label: "Mailbox Settings" },
  ]

  return (
    <div className="flex flex-col justify-between gap-3 border-b border-border/70 bg-card/60 px-6 py-3.5 backdrop-blur-xs sm:flex-row sm:items-center">
      <div className="flex items-center gap-3">
        <div className="rounded-lg border border-primary/20 bg-primary/10 p-2 text-primary">
          <Mail className="size-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold tracking-tight text-foreground">
              Mailbox
            </h1>
            {unreadCount > 0 && (
              <Badge className="bg-primary px-1.5 py-0">
                {unreadCount} unread
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Sent outreach threads & classified prospect responses across all
            campaigns
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <div
          role="tablist"
          aria-label="Mailbox view"
          className="flex items-center rounded-md border border-border/80 bg-muted/40 p-0.5"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium text-muted-foreground transition-all hover:text-foreground",
                "aria-selected:bg-background aria-selected:font-semibold aria-selected:text-foreground aria-selected:shadow-2xs"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <RefreshCw
            className={cn(
              "size-3.5",
              isRefreshing && "animate-spin text-primary"
            )}
          />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>
    </div>
  )
}

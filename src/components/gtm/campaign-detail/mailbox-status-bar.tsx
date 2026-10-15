"use client"

import { Mail } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { useCampaignDetail } from "./campaign-detail-root"

/** Connected sending mailbox and today's send count, or a prompt to connect one. */
export function MailboxStatusBar() {
  const { mailbox, disconnectMailbox } = useCampaignDetail()

  if (!mailbox) {
    return (
      <Card className="flex flex-col justify-between gap-3 border-warning-border bg-warning-tint p-4 sm:flex-row sm:items-center">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-warning">
            <Mail className="size-4 text-warning" />
            Gmail Mailbox Not Connected
          </div>
          <p className="text-xs text-muted-foreground">
            Connect a Google account with send-only permissions to dispatch
            approved outreach emails with safe throttling.
          </p>
        </div>
        <a
          href="/api/gtm/mailbox/connect"
          className={cn(
            buttonVariants({ size: "sm" }),
            "shrink-0 bg-warning text-xs text-white hover:bg-warning"
          )}
        >
          Connect Gmail Account
        </a>
      </Card>
    )
  }

  return (
    <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className="gap-1 border-success-border text-[11px] text-success"
        >
          <span className="size-1.5 rounded-full bg-success" />
          Connected: {mailbox.email}
        </Badge>
        <span className="text-[11px]">
          Daily sends today: {mailbox.dailySendCount} / 50
        </span>
      </div>
      <button
        type="button"
        onClick={disconnectMailbox}
        className="text-[11px] text-muted-foreground underline hover:text-danger"
      >
        Disconnect Mailbox
      </button>
    </div>
  )
}

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
      <Card className="flex flex-col justify-between gap-3 border-amber-500/30 bg-amber-500/5 p-4 sm:flex-row sm:items-center">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-900 dark:text-amber-200">
            <Mail className="size-4 text-amber-600" />
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
            "shrink-0 bg-amber-600 text-xs text-white hover:bg-amber-700"
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
          className="gap-1 border-emerald-500/40 text-[11px] text-emerald-600 dark:text-emerald-400"
        >
          <span className="size-1.5 rounded-full bg-emerald-500" />
          Connected: {mailbox.email}
        </Badge>
        <span className="text-[11px]">
          Daily sends today: {mailbox.dailySendCount} / 50
        </span>
      </div>
      <button
        type="button"
        onClick={disconnectMailbox}
        className="text-[11px] text-muted-foreground underline hover:text-rose-500"
      >
        Disconnect Mailbox
      </button>
    </div>
  )
}

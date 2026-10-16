"use client"

import * as React from "react"
import { Mail, MoreHorizontal } from "@/components/ui/icons"
import { GoogleLogo } from "@/components/ui/google-logo"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useCampaignDetail } from "./campaign-detail-root"

/** The server's default daily cap (GMAIL_DAILY_SEND_CAP can change it; the client can't see it). */
const DAILY_SEND_CAP = 50

/**
 * "Sending from you@… · 2 of 50 sent today", with Disconnect behind a
 * "Mailbox options" menu and a confirm dialog (it stops sending, so it is
 * never a bare link). Not connected: one line and the existing connect flow.
 */
export function MailboxStatusBar() {
  const { mailbox, disconnectMailbox } = useCampaignDetail()
  const [confirming, setConfirming] = React.useState(false)
  const [busy, setBusy] = React.useState(false)

  if (!mailbox) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-transparent bg-surface p-4 shadow-surface sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-body text-fg-default">
          <Mail className="mt-0.5 size-4 shrink-0 text-fg-muted" />
          Connect a mailbox to send the emails you approve. Scrunity only asks
          for permission to send.
        </p>
        <a href="/api/gtm/mailbox/connect" className={buttonVariants({ className: "shrink-0" })}>
          <GoogleLogo />
          Connect Gmail
        </a>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 items-center justify-between gap-2">
      <p className="flex min-w-0 flex-wrap items-center gap-x-2 text-body text-fg-muted">
        <Mail className="size-4 shrink-0" />
        <span className="min-w-0 truncate">
          Sending from <span className="text-fg-default">{mailbox.email}</span>
        </span>
        <span aria-hidden="true">·</span>
        <span className="tabular-nums">
          {mailbox.dailySendCount} of {DAILY_SEND_CAP} sent today
        </span>
      </p>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Mailbox options" />}>
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem variant="danger" onClick={() => setConfirming(true)}>
            Disconnect mailbox
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect {mailbox.email}?</DialogTitle>
            <DialogDescription>
              Approved emails won&apos;t be sent from this address until you
              connect a mailbox again. Your drafts and sent history stay.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button />}>Cancel</DialogClose>
            <Button
              variant="danger"
              loading={busy}
              onClick={async () => {
                setBusy(true)
                await disconnectMailbox()
                setBusy(false)
                setConfirming(false)
              }}
            >
              Disconnect mailbox
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

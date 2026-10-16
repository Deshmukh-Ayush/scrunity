"use client"

import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { AlertTriangle } from "@/components/ui/icons"
import { MailThreadsIllustration } from "@/components/ui/illustrations/mail-threads"
import { ThreadListSkeleton } from "./thread-list"

/** The existing Gmail OAuth flow (GET redirects to Google, back to Settings). */
export const CONNECT_GMAIL_HREF = "/api/gtm/mailbox/connect"
const SCOPE_LINE =
  "Only emails from your Scrunity campaigns and the replies to them appear here, not your whole inbox."

/** No mailbox connected: the one brand action on the page is Connect Gmail. */
export function MailboxNotConnected({
  settingsHref,
}: {
  settingsHref: string
}) {
  return (
    <EmptyState
      illustration={<MailThreadsIllustration />}
      title="Connect your mailbox"
      description={`Campaign emails are sent from it and replies are read back. ${SCOPE_LINE}`}
      actions={
        <>
          {/* A plain link: the connect route redirects to Google. */}
          <a
            href={CONNECT_GMAIL_HREF}
            className={buttonVariants({ variant: "brand" })}
          >
            Connect Gmail
          </a>
          <Link
            href={settingsHref}
            className={buttonVariants({ variant: "ghost" })}
          >
            Other providers
          </Link>
        </>
      }
    />
  )
}

/**
 * First sync after connecting. Skeleton rows, no progress bar (the backend
 * reports none). The polite live region is rendered before it has text, so
 * the "done" announcement is read when `finished` flips.
 */
export function MailboxSyncing({
  email,
  finished = false,
}: {
  email: string
  finished?: boolean
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col items-center gap-1 px-6 pt-10 pb-6 text-center">
        <p className="text-section text-fg-strong">
          Checking {email} for replies
        </p>
        <p className="max-w-sm text-body text-fg-muted">{SCOPE_LINE}</p>
      </div>
      <div className="mx-auto w-full max-w-md px-2">
        <ThreadListSkeleton rows={4} />
      </div>
      <p role="status" aria-live="polite" className="sr-only">
        {finished ? "Your mailbox is up to date." : ""}
      </p>
    </div>
  )
}

/** Connected, nothing sent yet. */
export function MailboxNoConversations() {
  return (
    <EmptyState
      illustration={<MailThreadsIllustration />}
      title="No conversations yet"
      description={`Emails your campaigns send, and the replies to them, will appear here. ${SCOPE_LINE}`}
      actions={
        <Link href="/dashboard/campaigns" className={buttonVariants()}>
          Go to campaigns
        </Link>
      }
    />
  )
}

/**
 * The connection needs a person: access was revoked or expired, or reading
 * replies failed. Plain words and one action (the existing reconnect flow).
 */
export function MailboxAttentionBanner({
  email,
  reason = "revoked",
  reconnectHref = CONNECT_GMAIL_HREF,
}: {
  email: string
  reason?: "revoked" | "sync-error"
  /** Gmail reconnects through OAuth directly; other providers through Settings. */
  reconnectHref?: string
}) {
  const text =
    reason === "revoked"
      ? `Scrunity can no longer send from or read ${email}. Campaign emails can't be sent until you reconnect.`
      : `Replies to ${email} could not be checked. Reconnect to try again.`
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 border-b border-warning-border bg-warning-tint px-4 py-3 md:px-6"
    >
      <AlertTriangle
        aria-hidden="true"
        className="size-4 shrink-0 text-warning"
      />
      <p className="min-w-0 flex-1 text-body text-fg-default">
        <span className="font-medium text-warning">
          Mailbox needs reconnecting.{" "}
        </span>
        {text}
      </p>
      <a href={reconnectHref} className={buttonVariants({ size: "sm" })}>
        Reconnect
      </a>
    </div>
  )
}

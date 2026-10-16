"use client"

import * as React from "react"
import Link from "next/link"
import { Button, buttonVariants } from "@/components/ui/button"
import { AlertCircle, ArrowLeft } from "@/components/ui/icons"
import { emailSnippet } from "@/lib/email-text"
import { cn } from "@/lib/utils"
import type { MailboxThread } from "@/lib/mailbox-thread-types"
import { ThreadTimestamp } from "./mailbox-time"
import { MessageCard } from "./message-card"
import { ThreadStatusBadge, threadStatus } from "./thread-status"

/**
 * Right pane (or the whole page on phones): the thread header with subject,
 * contact, status and actions, a bounce banner when delivery failed, then the
 * messages as stacked cards. Focus moves to the subject when a thread opens
 * on phones, so screen readers and keyboard users land on the new content.
 */
export function ThreadPane({
  thread,
  onBack,
  focusOnOpen = false,
}: {
  thread: MailboxThread
  /** Phones only: back to the list. */
  onBack?: () => void
  focusOnOpen?: boolean
}) {
  const headingRef = React.useRef<HTMLHeadingElement>(null)
  const status = threadStatus(thread)

  React.useEffect(() => {
    if (focusOnOpen) headingRef.current?.focus()
  }, [focusOnOpen, thread.id])

  const who = [thread.contact.title, thread.company.name]
    .filter(Boolean)
    .join(" · ")
  const messageCount = thread.messages.length

  return (
    <section
      aria-labelledby="thread-subject"
      className="flex min-h-0 flex-1 flex-col"
    >
      <header className="flex shrink-0 flex-col gap-3 border-b border-border px-4 py-4 md:px-6">
        {onBack && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="-ms-2 w-fit md:hidden"
          >
            <ArrowLeft data-icon="inline-start" />
            Conversations
          </Button>
        )}
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h2
              id="thread-subject"
              ref={headingRef}
              tabIndex={-1}
              className="text-section text-fg-strong outline-none"
            >
              {emailSnippet(thread.subject) || "(No subject)"}
            </h2>
            <p className="text-body text-fg-default">
              <span className="font-medium text-fg-strong">
                {thread.contact.name}
              </span>
              {who && <span className="text-fg-muted"> · {who}</span>}
            </p>
            <p className="text-meta font-normal text-fg-muted">
              {thread.contact.email && <span>{thread.contact.email} · </span>}
              <span>
                {messageCount} {messageCount === 1 ? "message" : "messages"} ·
                First sent <ThreadTimestamp value={thread.sentAt} />
              </span>
            </p>
          </div>
          <ThreadStatusBadge status={status} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/dashboard/campaigns/${thread.campaign.id}`}
            className={buttonVariants({ size: "sm" })}
          >
            View campaign
          </Link>
          <Link
            href={`/dashboard/leads?search=${encodeURIComponent(thread.contact.email || thread.contact.name)}`}
            className={buttonVariants({ size: "sm", variant: "ghost" })}
          >
            Open lead
          </Link>
          <span className="min-w-0 truncate text-meta font-normal text-fg-muted">
            {thread.campaign.name}
          </span>
        </div>
      </header>

      <div className="min-h-0 flex-1 md:overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-4 md:px-6">
          {thread.isBounced && (
            <div
              role="note"
              className="flex items-start gap-2.5 rounded-lg border border-danger-border bg-danger-tint p-3"
            >
              <AlertCircle
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-danger"
              />
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-body font-medium text-danger">
                  This email bounced
                </p>
                <p className="text-body break-words text-fg-default">
                  {emailSnippet(thread.bounceReason) ||
                    "The address could not be found."}
                </p>
              </div>
            </div>
          )}
          {thread.messages.map((message, index) => (
            <MessageCard key={message.id || index} message={message} />
          ))}
        </div>
      </div>
    </section>
  )
}

/** Desktop placeholder when no conversation is open. */
export function ThreadPanePlaceholder() {
  return (
    <div
      className={cn(
        "hidden min-h-0 flex-1 items-center justify-center p-8 md:flex"
      )}
    >
      <p className="text-body text-fg-muted">
        Select a conversation to read it.
      </p>
    </div>
  )
}

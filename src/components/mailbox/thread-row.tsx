"use client"

import * as React from "react"
import { emailSnippet } from "@/lib/email-text"
import { cn } from "@/lib/utils"
import type { MailboxThread } from "@/lib/mailbox-thread-types"
import { ThreadTimestamp } from "./mailbox-time"
import { ThreadStatusBadge, threadStatus } from "./thread-status"

/**
 * One conversation in the list: a listbox option, two lines.
 * Line 1: unread dot, contact name (semibold when unread), company, time.
 * Line 2: the thread's status badge and the latest message snippet.
 * Unread is a dot plus weight, never color alone. The selected row is a
 * white chip (bg-surface + shadow-raised) on the canvas list.
 */
export const ThreadRow = React.forwardRef<
  HTMLLIElement,
  {
    thread: MailboxThread
    selected: boolean
    focusable: boolean
    onOpen: () => void
    onKeyDown?: React.KeyboardEventHandler<HTMLLIElement>
    onFocus?: () => void
    "data-force"?: "hover" | "focus-visible"
  }
>(function ThreadRow(
  {
    thread,
    selected,
    focusable,
    onOpen,
    onKeyDown,
    onFocus,
    "data-force": dataForce,
  },
  ref
) {
  const status = threadStatus(thread)
  const snippet = emailSnippet(thread.latestSnippet)

  return (
    <li
      ref={ref}
      id={`thread-${thread.id}`}
      role="option"
      aria-selected={selected}
      tabIndex={focusable ? 0 : -1}
      data-force={dataForce}
      onClick={onOpen}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      className={cn(
        "flex cursor-pointer flex-col gap-1 rounded-md border border-transparent px-3 py-2.5 outline-none select-none",
        "transition-[background-color,box-shadow,border-color] duration-(--motion-fast) ease-out motion-reduce:transition-none",
        "ui-focus:focus-ring",
        selected ? "bg-surface shadow-raised" : "ui-hover:bg-muted"
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden="true"
          className={cn(
            "size-2 shrink-0 rounded-full",
            thread.isUnread ? "bg-fg-strong" : "bg-transparent"
          )}
        />
        <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
          {thread.isUnread && <span className="sr-only">Unread, </span>}
          <span
            className={cn(
              // The name keeps its width; the company truncates first.
              "max-w-[70%] shrink-0 truncate text-body text-fg-strong",
              thread.isUnread ? "font-semibold" : "font-medium"
            )}
          >
            {thread.contact.name}
          </span>
          {thread.company.name && (
            <span className="min-w-0 flex-1 truncate text-meta font-normal text-fg-muted">
              {thread.company.name}
            </span>
          )}
        </span>
        <span className="shrink-0 text-meta font-normal text-fg-muted tabular-nums">
          <ThreadTimestamp value={thread.lastActivityAt} />
        </span>
      </div>
      <div className="flex min-w-0 items-center gap-2 ps-4">
        <ThreadStatusBadge status={status} />
        <span
          className="min-w-0 truncate text-meta font-normal text-fg-muted"
          title={snippet}
        >
          {snippet}
        </span>
      </div>
    </li>
  )
})

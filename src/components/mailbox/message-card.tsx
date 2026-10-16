import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { MailboxMessage } from "@/lib/mailbox-thread-types"
import { EmailBody } from "./email-body"
import { MessageTimestamp } from "./mailbox-time"

/**
 * One message in a thread: a white surface card (shadow-surface) with the
 * sender's letter tile, name, address, exact time and the plain-text body.
 * Outbound messages carry a neutral "Sent" badge; direction is never color.
 */
export function MessageCard({
  message,
  className,
}: {
  message: MailboxMessage
  className?: string
}) {
  const sender = message.fromName || message.from
  return (
    <article
      aria-label={`${message.isOutbound ? "Sent" : "Message"} from ${sender}`}
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-transparent bg-surface p-4 shadow-surface",
        className
      )}
    >
      <header className="flex min-w-0 items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-body font-medium text-fg-default"
        >
          {sender.trim().charAt(0).toUpperCase() || "?"}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-body font-medium text-fg-strong">
              {sender}
            </span>
            {message.isOutbound && <Badge variant="neutral">Sent</Badge>}
          </div>
          <span
            className="truncate text-meta font-normal text-fg-muted"
            title={`${message.from} to ${message.to}`}
          >
            {message.from} to {message.to}
          </span>
        </div>
        <span className="shrink-0 text-meta font-normal text-fg-muted tabular-nums">
          <MessageTimestamp value={message.timestamp} />
        </span>
      </header>
      <EmailBody body={message.body} />
    </article>
  )
}

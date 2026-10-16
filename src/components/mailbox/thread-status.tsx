import { Badge } from "@/components/ui/badge"
import {
  Bot,
  HelpCircle,
  MessageSquare,
  Send,
  Sparkles,
  XCircle,
} from "@/components/ui/icons"
import { XCircleSolid } from "@/components/icons/status"
import type { MailboxThread } from "@/lib/mailbox-thread-types"

/**
 * The one status a thread shows, by priority: bounced, then the latest
 * reply's class, then "Sent" (no reply yet). Icon + label, never color
 * alone. Only Bounced has a tone (danger); reply classes stay neutral, since
 * green is reserved for verified and completed states (docs/design-system.md
 * "Mailbox").
 */
export interface ThreadStatus {
  label: string
  tone: "neutral" | "danger"
  Icon: React.ComponentType<{ className?: string; "data-icon"?: string }>
}

const STATUS: Record<string, ThreadStatus> = {
  bounced: { label: "Bounced", tone: "danger", Icon: XCircleSolid },
  interested: { label: "Interested", tone: "neutral", Icon: Sparkles },
  question: { label: "Question", tone: "neutral", Icon: MessageSquare },
  not_interested: { label: "Not interested", tone: "neutral", Icon: XCircle },
  auto_reply: { label: "Auto-reply", tone: "neutral", Icon: Bot },
  unclear: { label: "Unclear", tone: "neutral", Icon: HelpCircle },
  sent: { label: "Sent", tone: "neutral", Icon: Send },
}

export function threadStatus(
  thread: Pick<MailboxThread, "isBounced" | "classifiedIntent" | "hasReply">
) {
  if (thread.isBounced) return STATUS.bounced
  if (thread.classifiedIntent)
    return STATUS[thread.classifiedIntent] ?? STATUS.unclear
  // A reply the classifier has not labeled yet still reads as a reply.
  if (thread.hasReply) return STATUS.unclear
  return STATUS.sent
}

export function ThreadStatusBadge({ status }: { status: ThreadStatus }) {
  const { Icon } = status
  return (
    <Badge variant={status.tone}>
      <Icon data-icon="inline-start" />
      {status.label}
    </Badge>
  )
}

/** Every status, for the testing route and docs. */
export const THREAD_STATUSES = STATUS

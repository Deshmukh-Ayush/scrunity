import { Badge } from "@/components/ui/badge"
import type { MailboxThread } from "@/lib/mailbox-thread-types"

/** Classified intent of a prospect's latest reply. Renders nothing when unclassified. */
export function IntentBadge({
  intent,
}: {
  intent: MailboxThread["classifiedIntent"]
}) {
  if (!intent) return null

  switch (intent) {
    case "interested":
      return (
        <Badge
          variant="neutral"
          className="shrink-0 gap-1 px-2 py-0.5">
          <span className="size-1.5 rounded-full bg-fg-muted" />
          Interested
        </Badge>
      )
    case "question":
      return (
        <Badge
          variant="neutral"
          className="shrink-0 gap-1 px-2 py-0.5">
          <span className="size-1.5 rounded-full bg-primary" />
          Question
        </Badge>
      )
    case "not_interested":
      return (
        <Badge
          variant="outline"
          className="shrink-0 gap-1 border-border/70 bg-muted/40 px-2 py-0.5 text-muted-foreground">
          <span className="size-1.5 rounded-full bg-muted-foreground/60" />
          Not Interested
        </Badge>
      )
    case "auto_reply":
      return (
        <Badge
          variant="outline"
          className="shrink-0 gap-1 border-border/70 bg-muted/30 px-2 py-0.5 text-muted-foreground">
          Auto Reply
        </Badge>
      )
    case "unclear":
    default:
      return (
        <Badge
          variant="outline"
          className="shrink-0 border-border/70 bg-muted/20 px-2 py-0.5 text-muted-foreground">
          Unclear
        </Badge>
      )
  }
}

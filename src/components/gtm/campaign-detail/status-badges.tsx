import { AlertTriangleSolid, CheckCircleSolid, XCircleSolid } from "@/components/icons/status"
import { Check, HelpCircle, Send, ShieldCheck, X } from "@/components/ui/icons"
import { Badge } from "@/components/ui/badge"
import type { DraftStatus } from "./types"

/** How a contact's email address was found, from verified-on-site down to fallback. */
export function EmailSourceBadge({ source }: { source: string }) {
  switch (source) {
    case "verified":
      return (
        <Badge variant="success" className="gap-1">
          <CheckCircleSolid className="size-3" /> Verified
        </Badge>
      )
    case "found_on_site":
      return (
        <Badge variant="neutral" className="gap-1">
          <ShieldCheck className="size-3" /> Found on site
        </Badge>
      )
    case "pattern_guessed_mx_valid":
    case "pattern_guessed_unverified":
      return (
        <Badge
          variant="warning"
          className="gap-1">
          <AlertTriangleSolid className="size-3" /> Pattern guessed (unverified)
        </Badge>
      )
    case "company_fallback":
      return (
        <Badge
          variant="neutral"
          className="gap-1 text-muted-foreground">
          <HelpCircle className="size-3" /> Company fallback
        </Badge>
      )
    default:
      return (
        <Badge variant="neutral">
          No email found
        </Badge>
      )
  }
}

function isBouncedDraft(errorMessage?: string | null, hasBounced?: boolean) {
  return Boolean(
    hasBounced ||
    errorMessage?.toLowerCase().includes("bounced") ||
    errorMessage?.includes("550") ||
    errorMessage?.toLowerCase().includes("address not found")
  )
}

/** A draft's review/delivery state; bounces override the stored status. */
export function DraftStatusBadge({
  status,
  errorMessage,
  hasBounced,
}: {
  status: DraftStatus
  errorMessage?: string | null
  hasBounced?: boolean
}) {
  if (isBouncedDraft(errorMessage, hasBounced)) {
    return (
      <Badge
        variant="danger"
        className="gap-1">
        <XCircleSolid className="size-3" /> Bounced
      </Badge>
    )
  }

  switch (status) {
    case "sent":
      return (
        <Badge variant="neutral">
          <Send /> Sent
        </Badge>
      )
    case "failed":
      return (
        <Badge variant="danger" className="gap-1">
          <XCircleSolid className="size-3" /> Failed
        </Badge>
      )
    case "approved":
      return (
        <Badge variant="neutral">
          <Check /> Approved
        </Badge>
      )
    case "rejected":
      // A decision, not an error: neutral, with an icon.
      return (
        <Badge variant="neutral">
          <X /> Rejected
        </Badge>
      )
    default:
      return (
        <Badge variant="neutral">
          Waiting for review
        </Badge>
      )
  }
}

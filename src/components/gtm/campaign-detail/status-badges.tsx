import {
  AlertCircle,
  AlertTriangle,
  Check,
  HelpCircle,
  ShieldCheck,
  XCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { DraftStatus } from "./types"

/** How a contact's email address was found, from verified-on-site down to fallback. */
export function EmailSourceBadge({ source }: { source: string }) {
  switch (source) {
    case "verified":
      return (
        <Badge variant="default" className="gap-1 bg-success text-[10px]">
          <ShieldCheck className="size-3" /> Verified
        </Badge>
      )
    case "found_on_site":
      return (
        <Badge variant="default" className="gap-1 bg-success text-[10px]">
          <ShieldCheck className="size-3" /> Found on Site
        </Badge>
      )
    case "pattern_guessed_mx_valid":
      return (
        <Badge
          variant="outline"
          className="gap-1 border-primary/40 bg-primary/10 text-[10px] text-primary"
        >
          <ShieldCheck className="size-3" /> Pattern Guessed (MX Valid)
        </Badge>
      )
    case "pattern_guessed_unverified":
      return (
        <Badge
          variant="outline"
          className="gap-1 border-warning-border text-[10px] text-warning"
        >
          <AlertCircle className="size-3" /> Pattern Guessed (Unverified)
        </Badge>
      )
    case "company_fallback":
      return (
        <Badge
          variant="outline"
          className="gap-1 text-[10px] text-muted-foreground"
        >
          <HelpCircle className="size-3" /> Company Fallback
        </Badge>
      )
    default:
      return (
        <Badge variant="secondary" className="text-[10px]">
          No Email Found
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
        variant="destructive"
        className="gap-1 border-danger-border bg-danger-tint text-xs text-danger capitalize"
      >
        <AlertTriangle className="size-3" /> Bounced
      </Badge>
    )
  }

  switch (status) {
    case "sent":
      return (
        <Badge className="gap-1 bg-success text-xs text-white capitalize hover:bg-success">
          <Check className="size-3" /> Sent
        </Badge>
      )
    case "failed":
      return (
        <Badge variant="destructive" className="gap-1 text-xs capitalize">
          <XCircle className="size-3" /> Failed
        </Badge>
      )
    case "approved":
      return (
        <Badge
          variant="default"
          className="border-success-border bg-success-tint text-xs text-success capitalize"
        >
          Approved
        </Badge>
      )
    case "rejected":
      return (
        <Badge variant="destructive" className="text-xs capitalize">
          Rejected
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="text-xs capitalize">
          Draft
        </Badge>
      )
  }
}

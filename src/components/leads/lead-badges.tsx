import { AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { isValidPersonName } from "@/lib/gtm-contact-matcher"

export function LinkedinIcon({ className = "size-3" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
    </svg>
  )
}

/**
 * Lead pipeline status. Contacts whose "name" is not a real person (e.g. a job
 * title) show as Pending Re-discovery regardless of their stored status.
 */
export function LeadStatusBadge({
  lead,
}: {
  lead: { status: string; rejectionReason?: string | null; name?: string }
}) {
  const { status, rejectionReason, name } = lead

  // A rate-limited lookup, not a bad contact: its placeholder name is expected.
  if (status === "lookup_incomplete") {
    return (
      <Badge
        variant="outline"
        title="Web lookups for this contact were rate-limited. It was not disqualified."
        className="inline-flex items-center gap-1 border-amber-500/40 bg-amber-500/10 text-[11px] font-medium text-amber-600 dark:text-amber-400"
      >
        <AlertTriangle className="size-3 shrink-0 text-amber-500" />
        Lookup Incomplete
      </Badge>
    )
  }
  const hasInvalidName = Boolean(name) && !isValidPersonName(name || "")
  const isPendingRediscovery =
    hasInvalidName ||
    (status === "disqualified" &&
      Boolean(rejectionReason?.toLowerCase().includes("pending re-discovery")))

  if (isPendingRediscovery) {
    return (
      <Badge
        variant="outline"
        className="inline-flex items-center gap-1 border-amber-500/40 bg-amber-500/10 text-[11px] font-medium text-amber-600 dark:text-amber-400"
      >
        <AlertTriangle className="size-3 shrink-0 text-amber-500" />
        Pending Re-discovery
      </Badge>
    )
  }

  switch (status) {
    case "meeting_booked":
      return <Badge variant="default">Meeting Booked</Badge>
    case "replied":
      return <Badge variant="default">Replied</Badge>
    case "sent":
      return <Badge variant="secondary">Sent</Badge>
    case "bounced":
      return (
        <Badge
          variant="outline"
          className="inline-flex items-center gap-1 border-rose-500/40 bg-rose-500/10 text-[11px] font-medium text-rose-600 dark:text-rose-400"
        >
          <AlertTriangle className="size-3 shrink-0 text-rose-500" />
          Bounced
        </Badge>
      )
    case "approved":
      return <Badge variant="outline">Approved</Badge>
    case "drafted":
      return <Badge variant="outline">Drafted</Badge>
    case "disqualified":
      return <Badge variant="destructive">Disqualified</Badge>
    case "failed":
      return <Badge variant="destructive">Failed</Badge>
    case "discovered":
    default:
      return <Badge variant="secondary">Discovered</Badge>
  }
}

/** How confident we are in the lead's email address. */
export function VerificationBadge({ status }: { status: string }) {
  switch (status) {
    case "verified":
    case "enrich_verified":
      return (
        <Badge variant="default" className="text-[10px]">
          Verified
        </Badge>
      )
    case "pattern_guessed_mx_valid":
      return (
        <Badge
          variant="outline"
          className="border-emerald-500/40 text-[10px] text-emerald-600"
        >
          MX Valid
        </Badge>
      )
    case "pattern_guessed_unverified":
      return (
        <Badge variant="secondary" className="text-[10px]">
          Pattern Guessed
        </Badge>
      )
    case "found_on_site":
      return (
        <Badge variant="outline" className="text-[10px]">
          Found on Site
        </Badge>
      )
    case "company_fallback":
      return (
        <Badge variant="secondary" className="text-[10px]">
          Company Fallback
        </Badge>
      )
    case "unverified":
    default:
      return (
        <Badge variant="secondary" className="text-[10px]">
          Unverified
        </Badge>
      )
  }
}

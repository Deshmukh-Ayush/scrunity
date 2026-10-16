"use client"

import Link from "next/link"
import {
  AlertCircle,
  AlertTriangle,
  Inbox,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
} from "@/components/ui/icons"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { isValidPersonName } from "@/lib/gtm-contact-matcher"
import { checkLeadQualificationGates } from "@/lib/gtm-qualification-gates"
import { formatErrorMessage } from "@/lib/gtm-error-formatter"
import type { Lead } from "./types"

function InlineNote({
  tone,
  title,
  children,
}: {
  tone: "warning" | "danger" | "muted"
  title: string
  children: React.ReactNode
}) {
  return (
    <span
      data-tone={tone}
      title={title}
      className={cn(
        "inline-flex max-w-[150px] items-center gap-1 truncate text-[11px] italic",
        "data-[tone=muted]:text-muted-foreground",
        "data-[tone=warning]:font-medium data-[tone=warning]:text-warning",
        "data-[tone=danger]:font-medium data-[tone=danger]:text-danger"
      )}
    >
      {children}
    </span>
  )
}

/**
 * The single next step for a lead, in priority order: disqualified/bounced notes,
 * blocked (invalid name or failed gates), view sent mail, review a draft, retry a
 * failed send, or draft a first email.
 */
export function LeadAction({
  lead,
  isDrafting,
  onDraft,
  onReview,
}: {
  lead: Lead
  isDrafting: boolean
  onDraft: (lead: Lead) => void
  onReview: (lead: Lead) => void
}) {
  const isNameValid = isValidPersonName(lead.name)

  if (lead.status === "disqualified") {
    const formatted = formatErrorMessage(
      lead.rejectionReason || "Disqualified during review"
    )
    const isPendingRediscovery =
      formatted.formattedMessage
        .toLowerCase()
        .includes("pending re-discovery") || !isNameValid
    return (
      <InlineNote
        tone={isPendingRediscovery ? "warning" : "muted"}
        title={formatted.formattedMessage}
      >
        {isPendingRediscovery && (
          <AlertTriangle className="size-3 shrink-0 text-warning" />
        )}
        <span className="truncate">{formatted.formattedMessage}</span>
      </InlineNote>
    )
  }

  if (lead.status === "bounced") {
    return (
      <InlineNote
        tone="danger"
        title="Email delivery failed (bounced) — pending re-discovery"
      >
        <AlertCircle className="size-3 shrink-0 text-danger" />
        <span className="truncate">Pending Re-discovery</span>
      </InlineNote>
    )
  }

  if (!isNameValid) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled
        className="cursor-not-allowed gap-1.5 opacity-60"
        title="Contact name is a job title — pending re-discovery"
      >
        <AlertCircle className="size-3 text-warning" />
        Pending Re-discovery
      </Button>
    )
  }

  const gateCheck = checkLeadQualificationGates(lead)
  if (!gateCheck.qualified) {
    return (
      <InlineNote tone="warning" title={gateCheck.reason || ""}>
        <AlertTriangle className="size-3 shrink-0 text-warning" />
        <span className="truncate">{gateCheck.reason}</span>
      </InlineNote>
    )
  }

  if (
    lead.status === "sent" ||
    lead.status === "replied" ||
    lead.status === "meeting_booked"
  ) {
    const href = lead.threadId
      ? `/dashboard/mailbox?threadId=${encodeURIComponent(lead.threadId)}`
      : `/dashboard/mailbox?contactId=${encodeURIComponent(lead.id)}`
    return (
      <Link
        href={href}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "h-7 gap-1.5 border-border/80 px-2.5 text-xs text-muted-foreground hover:text-foreground"
        )}
      >
        <Inbox className="size-3" />
        View in Mailbox
      </Link>
    )
  }

  if (
    lead.status === "drafted" ||
    lead.status === "approved" ||
    (lead.draftId && lead.status !== "failed")
  ) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => onReview(lead)}
        className="gap-1.5"
      >
        <Send className="size-3" />
        Review & Send
      </Button>
    )
  }

  if (lead.status === "failed") {
    const formatted = formatErrorMessage(
      lead.rejectionReason || "Email dispatch failed"
    )
    return (
      <div className="flex items-center justify-end gap-1.5">
        <span
          className="max-w-[120px] truncate text-[11px] font-medium text-danger italic"
          title={formatted.formattedMessage}
        >
          {formatted.headline}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDraft(lead)}
          disabled={isDrafting}
          className="gap-1"
          title="Retry drafting"
        >
          {isDrafting ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <RefreshCw className="size-3" />
          )}
          Retry
        </Button>
      </div>
    )
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => onDraft(lead)}
      disabled={isDrafting}
      className="gap-1.5"
    >
      {isDrafting ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <Sparkles className="size-3" />
      )}
      Draft Email
    </Button>
  )
}

"use client"

import Link from "next/link"
import { ExternalLink } from "lucide-react"
import { TableCell, TableRow } from "@/components/ui/table"
import { LeadAction } from "./lead-action"
import { LeadStatusBadge, LinkedinIcon, VerificationBadge } from "./lead-badges"
import type { Lead } from "./types"

/** One lead: contact, title, company, campaign, status, email confidence and next action. */
export function LeadRow({
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
  return (
    <TableRow className="transition-colors hover:bg-muted/40">
      <TableCell className="font-medium">
        <div className="flex items-center gap-1.5">
          <span
            className="max-w-[180px] truncate font-medium text-foreground"
            title={lead.name}
          >
            {lead.name}
          </span>
          {lead.linkedinUrl && (
            <a
              href={lead.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 text-muted-foreground transition-colors hover:text-blue-500"
              title="Open LinkedIn profile"
              aria-label={`${lead.name} on LinkedIn`}
            >
              <LinkedinIcon className="size-3" />
            </a>
          )}
        </div>
      </TableCell>

      <TableCell>
        <span
          className="block max-w-[170px] truncate text-muted-foreground"
          title={lead.title}
        >
          {lead.title || "—"}
        </span>
      </TableCell>

      <TableCell>
        <div className="flex max-w-[210px] flex-col">
          <span
            className="truncate font-medium text-foreground"
            title={lead.companyName}
          >
            {lead.companyName}
          </span>
          {lead.companyDomain && (
            <a
              href={`https://${lead.companyDomain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 truncate text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              title={`Visit ${lead.companyDomain}`}
            >
              <span>{lead.companyDomain}</span>
              <ExternalLink className="size-2.5 shrink-0 opacity-60" />
            </a>
          )}
        </div>
      </TableCell>

      <TableCell>
        <Link
          href="/dashboard/campaigns"
          className="block max-w-[190px] truncate text-xs text-foreground transition-colors hover:text-primary hover:underline"
          title={lead.campaignName}
        >
          {lead.campaignName}
        </Link>
      </TableCell>

      <TableCell>
        <LeadStatusBadge lead={lead} />
      </TableCell>

      <TableCell>
        {lead.email ? (
          <div className="flex max-w-[260px] flex-wrap items-center gap-1.5">
            <span
              className="truncate font-mono text-[11px] text-foreground"
              title={lead.email}
            >
              {lead.email}
            </span>
            <VerificationBadge status={lead.verificationStatus} />
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>

      <TableCell className="pr-4 text-right">
        <LeadAction
          lead={lead}
          isDrafting={isDrafting}
          onDraft={onDraft}
          onReview={onReview}
        />
      </TableCell>
    </TableRow>
  )
}

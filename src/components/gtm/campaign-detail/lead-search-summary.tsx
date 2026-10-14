"use client"

import { leadSearchMessage } from "@/lib/lead-search-message"
import { LeadSummaryLine, SkippedLeads } from "@/components/leads/skipped-leads"
import { useCampaignDetail } from "./campaign-detail-root"

/**
 * How the verified-lead search ended ("Reached target (10 verified)" or
 * "Found 4 of 10: budget reached..."), the quiet "Reviewed N people · M
 * verified" line, and the closed, neutral Skipped list. Renders nothing before
 * any person was reviewed.
 */
export function LeadSearchSummary() {
  const { data } = useCampaignDetail()
  const outcome = data.campaign.leadSearchOutcome
  const summary = data.leadSummary ?? { reviewed: 0, verified: 0 }
  const skipped = data.skippedContacts ?? []
  if (!outcome && summary.reviewed === 0) return null

  return (
    <div className="space-y-2" data-slot="lead-search-summary">
      <div className="space-y-0.5">
        {outcome && (
          <p role="status" className="text-xs text-foreground">
            {leadSearchMessage(outcome)}
          </p>
        )}
        <LeadSummaryLine reviewed={summary.reviewed} verified={summary.verified} />
      </div>
      <SkippedLeads count={skipped.length} leads={skipped} />
    </div>
  )
}

"use client"

import { AlertTriangle, CheckCircle2, Loader2, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useCampaignDetail } from "./campaign-detail-root"
import { DraftCard } from "./draft-card"
import { LeadSearchSummary } from "./lead-search-summary"

/**
 * What to show before any draft exists. Recovery actions (restart, re-run) are
 * deliberately not repeated here; they live in the header and status banner.
 */
function EmptyDrafts() {
  const { data, staleness } = useCampaignDetail()
  const { campaign } = data

  let icon = <Mail className="size-8 text-muted-foreground/50" />
  let title = "No drafts generated yet"
  let body: React.ReactNode =
    "Run the autonomous research pipeline to discover ICP companies, scrape key decision-makers, and draft emails."

  if (campaign.status === "in_progress" && staleness.isStalled) {
    icon = <AlertTriangle className="size-6 text-warning" />
    title = "Pipeline Execution Stalled"
    body = staleness.explanation
  } else if (campaign.status === "in_progress") {
    icon = <Loader2 className="size-6 animate-spin text-primary" />
    title = "Autonomous Pipeline is Active"
    body = (
      <>
        The agent is currently executing stage{" "}
        <span className="font-semibold text-foreground">
          {campaign.currentStage.replace(/_/g, " ")}
        </span>
        . Prospect companies, verified contacts, and tailored drafts will appear
        automatically here.
      </>
    )
  }

  return (
    <Card className="border-dashed p-8 text-center text-xs">
      <div className="flex flex-col items-center justify-center space-y-3">
        {icon}
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="mx-auto max-w-md text-xs text-muted-foreground">
            {body}
          </p>
        </div>
      </div>
    </Card>
  )
}

/** Generated drafts with review counts and a bulk approve action. */
export function DraftReviewSection() {
  const { drafts, counts, isUpdating, approveAllDrafts } = useCampaignDetail()

  return (
    <section className="space-y-4" aria-labelledby="draft-review-heading">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            id="draft-review-heading"
            className="flex items-center gap-2 text-base font-semibold text-foreground"
          >
            <Mail className="size-4 text-primary" />
            Generated Email Drafts ({drafts.length})
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Review and approve drafts before dispatch. Sending is safely
            throttled (30-90s delay) via Gmail.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs text-muted-foreground">
            {counts.approved} Approved / {counts.sent} Sent
          </span>
          {counts.pending > 0 && (
            <Button
              variant="outline"
              size="md"
              onClick={approveAllDrafts}
              disabled={isUpdating}
              className="gap-1.5"
            >
              {isUpdating ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="size-3.5" />
              )}
              Approve All ({counts.pending})
            </Button>
          )}
        </div>
      </div>

      <LeadSearchSummary />

      {drafts.length === 0 ? (
        <EmptyDrafts />
      ) : (
        <div className="space-y-4">
          {drafts.map((d) => (
            <DraftCard key={d.id} draft={d} />
          ))}
        </div>
      )}
    </section>
  )
}

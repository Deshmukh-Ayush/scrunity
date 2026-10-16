"use client"

import Link from "next/link"
import { CheckCircle2 } from "@/components/ui/icons"
import { Button, buttonVariants } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { useCampaignDetail } from "./campaign-detail-root"
import { DraftCard } from "./draft-card"

/**
 * "Your review": the counts, Approve all, and one card per email with its
 * own approve, reject and edit actions. Nothing is sent from here; sending
 * starts from the header once emails are approved.
 */
export function DraftReviewSection() {
  const { drafts, counts, isUpdating, approveAllDrafts, process } = useCampaignDetail()

  if (drafts.length === 0) {
    return (
      <div
        className={
          process.state === "no-results"
            ? "rounded-xl border border-transparent bg-surface shadow-surface"
            : "rounded-xl border border-dashed border-border-strong"
        }
      >
        <EmptyState
          size={process.state === "no-results" ? "default" : "sm"}
          role={process.state === "no-results" ? "status" : undefined}
          title="No emails to review"
          description={
            process.state === "no-results"
              ? "No contact had a verified email, so no emails were written. See Verified contacts for who was checked."
              : "Emails appear here once they're written. Nothing is sent until you approve it."
          }
          actions={
            process.state === "no-results" ? (
              <Link href="/dashboard/campaigns/new" className={buttonVariants()}>
                Start a new research run
              </Link>
            ) : undefined
          }
        />
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-body text-fg-muted tabular-nums">
          {counts.pending} waiting · {counts.approved} approved · {counts.sent} sent
          {counts.rejected > 0 ? ` · ${counts.rejected} rejected` : ""}
        </p>
        {counts.pending > 0 && (
          <Button onClick={approveAllDrafts} loading={isUpdating}>
            <CheckCircle2 data-icon="inline-start" />
            {`Approve all ${counts.pending}`}
          </Button>
        )}
      </div>
      <ul aria-label="Emails to review" className="flex flex-col gap-3">
        {drafts.map((d) => (
          <li key={d.id}>
            <DraftCard draft={d} />
          </li>
        ))}
      </ul>
    </>
  )
}

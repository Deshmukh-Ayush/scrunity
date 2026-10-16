"use client"

import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { LeadSummaryLine, SkippedLeads } from "@/components/leads/skipped-leads"
import { leadSearchMessage } from "@/lib/lead-search-message"
import { CAMPAIGN_STAGES } from "../process/campaign-process"
import { useCampaignDetail } from "./campaign-detail-root"
import { STAGE_DETAIL_ID } from "./campaign-process-card"
import { CompanySelection } from "./company-selection/company-selection"
import { DraftReviewSection } from "./draft-review-section"
import { CompaniesTable, ContactsTable, DraftsTable } from "./stage-tables"

const plural = (n: number, one: string, many: string) =>
  `${n} ${new Intl.PluralRules("en").select(n) === "one" ? one : many}`

const newRunLink = (
  <Link href="/dashboard/campaigns/new" className={buttonVariants()}>
    Start a new research run
  </Link>
)

/** A stage that hasn't produced anything yet: what will be here, and when. */
function NotYet({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border-strong">
      <EmptyState size="sm" title={title} description={description} />
    </div>
  )
}

function CompaniesStage() {
  const { data, process } = useCampaignDetail()
  if (data.companies.length === 0) {
    return process.state === "no-results" ? (
      <div className="rounded-xl border border-transparent bg-surface shadow-surface">
        <EmptyState role="status" title="No companies found" description={process.noResultsReason ?? undefined} actions={newRunLink} />
      </div>
    ) : (
      <NotYet title="No companies yet" description="Companies that match this segment appear here as they're found." />
    )
  }
  if (data.usesCompanyDatabase) return <CompanySelection />
  return (
    <>
      {data.campaign.discoveryNote && <p className="text-body text-fg-muted">{data.campaign.discoveryNote}</p>}
      <CompaniesTable />
    </>
  )
}

function ContactsStage() {
  const { data, process } = useCampaignDetail()
  const summary = data.leadSummary ?? { reviewed: 0, verified: 0 }
  const skipped = data.skippedContacts ?? []
  const outcome = data.campaign.leadSearchOutcome

  if (data.contacts.length === 0) {
    if (summary.reviewed === 0 && process.state !== "no-results")
      return (
        <NotYet
          title="No contacts yet"
          description="Decision makers appear here once their email address is verified. Unverified addresses are never used."
        />
      )
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-xl border border-transparent bg-surface shadow-surface">
          <EmptyState
            role="status"
            title="No verified contacts"
            description={
              process.noResultsReason ??
              `${plural(summary.reviewed, "person was", "people were")} checked and none had a verified email yet.`
            }
            actions={process.state === "no-results" ? newRunLink : undefined}
          />
        </div>
        <LeadSummaryLine reviewed={summary.reviewed} verified={summary.verified} className="text-body text-fg-muted" />
        <SkippedLeads count={skipped.length} leads={skipped} />
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-0.5">
        {outcome && <p className="text-body text-fg-default">{leadSearchMessage(outcome)}</p>}
        <LeadSummaryLine reviewed={summary.reviewed} verified={summary.verified} className="text-body text-fg-muted" />
      </div>
      <ContactsTable />
      <SkippedLeads count={skipped.length} leads={skipped} />
    </>
  )
}

function WriteStage() {
  const { drafts, data } = useCampaignDetail()
  if (drafts.length === 0)
    return (
      <NotYet
        title="No emails yet"
        description={
          data.contacts.length > 0
            ? "A personal email is written for each verified contact."
            : "Emails are written once contacts are verified."
        }
      />
    )
  return (
    <>
      <p className="text-body text-fg-muted">
        {plural(drafts.length, "email was", "emails were")} written, one per verified contact. Open Your review to read and
        approve them.
      </p>
      <DraftsTable drafts={drafts} />
    </>
  )
}

function SendingStage() {
  const { drafts, counts, mailbox } = useCampaignDetail()
  const queue = drafts.filter((d) => d.status === "approved" || d.status === "sent" || d.status === "failed")
  if (queue.length === 0)
    return <NotYet title="Nothing to send yet" description="Approve emails in Your review, then send them from here." />
  return (
    <>
      <p className="text-body text-fg-muted tabular-nums">
        {counts.sent} of {counts.sent + counts.approved} sent.
        {mailbox ? " Emails go out a few at a time so they read as personal mail." : " Connect a mailbox to send."}
      </p>
      <DraftsTable drafts={queue} showSentAt />
    </>
  )
}

/**
 * The detail for the stage picked on the process card (the current stage
 * until the user picks another): a heading, a plain summary, then the content.
 */
export function StageDetail() {
  const { selectedStage } = useCampaignDetail()
  const stage = CAMPAIGN_STAGES[selectedStage]

  return (
    <section id={STAGE_DETAIL_ID} aria-labelledby={`${STAGE_DETAIL_ID}-title`} className="flex flex-col gap-4">
      <h2 id={`${STAGE_DETAIL_ID}-title`} className="text-section text-fg-strong">
        {stage.label}
      </h2>
      {selectedStage === 0 && <CompaniesStage />}
      {selectedStage === 1 && <ContactsStage />}
      {selectedStage === 2 && <WriteStage />}
      {selectedStage === 3 && <DraftReviewSection />}
      {selectedStage === 4 && <SendingStage />}
    </section>
  )
}

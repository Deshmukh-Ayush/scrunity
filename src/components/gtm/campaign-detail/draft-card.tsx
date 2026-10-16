"use client"

import * as React from "react"
import { AlertCircle, Check, Edit2, X } from "@/components/ui/icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LocalDate } from "@/components/ui/local-date"
import { Textarea } from "@/components/ui/textarea"
import { formatErrorMessage } from "@/lib/gtm-error-formatter"
import { useCampaignDetail } from "./campaign-detail-root"
import { DraftStatusBadge, EmailSourceBadge } from "./status-badges"
import type { Draft } from "./types"

/** Why an email couldn't go, in the formatter's plain words; the raw error stays on the server. */
function DraftError({ message }: { message: string }) {
  const formatted = formatErrorMessage(message)
  return (
    <div role="note" className="flex items-start gap-2 rounded-lg bg-danger-tint p-3 text-body">
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" />
      <div className="flex flex-col gap-0.5">
        <p className="font-medium text-danger">{formatted.headline}</p>
        {formatted.actionableStep && <p className="text-fg-default">{formatted.actionableStep}</p>}
      </div>
    </div>
  )
}

/**
 * One email for review: who it goes to, its status, the text, and the
 * review actions. White card in a list, so every action stays neutral.
 */
export function DraftCard({ draft }: { draft: Draft }) {
  const { reviewDraft, isUpdating } = useCampaignDetail()
  const [isEditing, setIsEditing] = React.useState(false)
  const [editSubject, setEditSubject] = React.useState("")
  const [editBody, setEditBody] = React.useState("")
  const subjectId = React.useId()
  const bodyId = React.useId()

  const startEditing = () => {
    setEditSubject(draft.subject)
    setEditBody(draft.body)
    setIsEditing(true)
  }

  const saveAndApprove = async () => {
    const ok = await reviewDraft(draft.id, "approve", { subject: editSubject, body: editBody })
    if (ok) setIsEditing(false)
  }

  const canReview = draft.status !== "sent"

  return (
    <article
      aria-label={`Email to ${draft.contact.name}`}
      data-status={draft.status}
      className="flex flex-col gap-3 rounded-xl border border-transparent bg-surface p-4 shadow-surface data-[status=rejected]:opacity-70"
    >
      <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="min-w-0 text-body text-fg-strong">
            <span className="font-medium">{draft.contact.name}</span>
            <span className="text-fg-muted">
              {" "}
              · {draft.contact.title} at {draft.company.name}
            </span>
          </p>
          <p className="min-w-0 truncate text-meta text-fg-muted">
            {draft.contact.email ?? "No email address"}
            {draft.sentAt && (
              <>
                {" · Sent "}
                <LocalDate value={draft.sentAt} kind="time" options={{ hour: "numeric", minute: "2-digit" }} />
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <EmailSourceBadge source={draft.contact.emailSource} />
          <DraftStatusBadge status={draft.status} errorMessage={draft.errorMessage} hasBounced={draft.hasBounced} />
        </div>
      </header>

      {draft.errorMessage && <DraftError message={draft.errorMessage} />}

      {isEditing ? (
        <div className="flex flex-col gap-2">
          <label htmlFor={subjectId} className="sr-only">
            Subject
          </label>
          <Input id={subjectId} value={editSubject} onChange={(e) => setEditSubject(e.target.value)} />
          <label htmlFor={bodyId} className="sr-only">
            Email text
          </label>
          <Textarea id={bodyId} value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={8} />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" loading={isUpdating} onClick={saveAndApprove}>
              Save and approve
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 rounded-lg bg-canvas p-3">
          <p className="text-body font-medium text-fg-strong">{draft.subject}</p>
          <p className="text-body whitespace-pre-wrap text-fg-default">{draft.body}</p>
        </div>
      )}

      {canReview && !isEditing && (
        <footer className="flex flex-wrap items-center justify-between gap-2">
          <Button size="sm" variant="ghost" onClick={startEditing}>
            <Edit2 data-icon="inline-start" />
            Edit
          </Button>
          <div className="flex items-center gap-2">
            <Button size="sm" disabled={isUpdating || draft.status === "rejected"} onClick={() => reviewDraft(draft.id, "reject")}>
              <X data-icon="inline-start" />
              Reject
            </Button>
            <Button size="sm" disabled={isUpdating || draft.status === "approved"} onClick={() => reviewDraft(draft.id, "approve")}>
              <Check data-icon="inline-start" />
              {draft.status === "approved" ? "Approved" : "Approve"}
            </Button>
          </div>
        </footer>
      )}
    </article>
  )
}

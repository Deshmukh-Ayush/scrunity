"use client"

import * as React from "react"
import { AlertCircle, CheckCircle2, Edit2, XCircle } from "@/components/ui/icons"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { LocalDate } from "@/components/ui/local-date"
import { cn } from "@/lib/utils"
import { formatErrorMessage } from "@/lib/gtm-error-formatter"
import { useCampaignDetail } from "./campaign-detail-root"
import { DraftStatusBadge, EmailSourceBadge } from "./status-badges"
import type { Draft } from "./types"

function DraftError({ message }: { message: string }) {
  const formatted = formatErrorMessage(message)
  return (
    <div className="mt-2 space-y-1.5 rounded-md bg-danger-tint p-2.5 text-xs shadow-surface">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-danger" />
        <div className="flex-1 space-y-0.5">
          <p className="font-semibold text-danger">
            {formatted.headline}
          </p>
          {formatted.actionableStep && (
            <p className="text-[11px] text-muted-foreground">
              {formatted.actionableStep}
            </p>
          )}
        </div>
      </div>
      {formatted.rawError && (
        <details className="border-t border-border/40 pt-1 text-[11px] text-muted-foreground">
          <summary className="cursor-pointer text-[10px] font-medium transition-colors select-none hover:text-foreground">
            Technical details
          </summary>
          <pre className="mt-1 overflow-x-auto rounded bg-muted/50 p-1.5 font-mono text-[10px] whitespace-pre-wrap text-muted-foreground">
            {formatted.rawError}
          </pre>
        </details>
      )}
    </div>
  )
}

/** One generated email: recipient, delivery state, and approve/reject/edit controls. */
export function DraftCard({ draft }: { draft: Draft }) {
  const { reviewDraft, isUpdating } = useCampaignDetail()
  const [isEditing, setIsEditing] = React.useState(false)
  const [editSubject, setEditSubject] = React.useState("")
  const [editBody, setEditBody] = React.useState("")

  const startEditing = () => {
    setEditSubject(draft.subject)
    setEditBody(draft.body)
    setIsEditing(true)
  }

  const saveAndApprove = async () => {
    const ok = await reviewDraft(draft.id, "approve", {
      subject: editSubject,
      body: editBody,
    })
    if (ok) setIsEditing(false)
  }

  return (
    <Card
      data-status={draft.status}
      className={cn(
        "border transition-all",
        "data-[status=sent]:border-success-border data-[status=sent]:bg-success-tint",
        "data-[status=failed]:border-danger-border data-[status=failed]:bg-danger-tint",
        "data-[status=approved]:border-success-border data-[status=approved]:bg-success-tint",
        "data-[status=rejected]:border-danger-border data-[status=rejected]:bg-danger-tint data-[status=rejected]:opacity-70"
      )}
    >
      <CardHeader className="p-4 pb-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {draft.contact.name}
            </span>
            <span className="text-xs text-muted-foreground">
              — {draft.contact.title} at {draft.company.name}
            </span>
            <EmailSourceBadge source={draft.contact.emailSource} />
          </div>
          <DraftStatusBadge
            status={draft.status}
            errorMessage={draft.errorMessage}
            hasBounced={draft.hasBounced}
          />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>
            Recipient:{" "}
            <span className="text-foreground">
              {draft.contact.email || "No email available"}
            </span>
          </span>
          {draft.providerMessageId && (
            <span className="font-mono text-[11px] text-muted-foreground">
              Gmail ID:{" "}
              <span className="font-semibold text-foreground">
                {draft.providerMessageId}
              </span>
            </span>
          )}
          {draft.sentAt && (
            <span className="text-[11px] text-muted-foreground">
              Sent: <LocalDate value={draft.sentAt} kind="time" />
            </span>
          )}
        </div>
        {draft.errorMessage && <DraftError message={draft.errorMessage} />}
      </CardHeader>

      <CardContent className="space-y-3 p-4 pt-2">
        {isEditing ? (
          <div className="space-y-2 pt-2">
            <Input
              value={editSubject}
              onChange={(e) => setEditSubject(e.target.value)}
              placeholder="Subject"
              aria-label="Subject"
              className="text-xs"
            />
            <Textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={5}
              aria-label="Email body"
              className="font-sans text-xs"
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={isUpdating}
                onClick={saveAndApprove}
              >
                Save & Approve
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-2 rounded-md bg-muted/20 p-3 text-xs shadow-surface">
              <div className="font-medium text-foreground">
                Subject: {draft.subject}
              </div>
              <div className="leading-relaxed whitespace-pre-wrap text-muted-foreground">
                {draft.body}
              </div>
            </div>

            {draft.status !== "sent" && (
              <div className="flex items-center justify-between pt-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1 text-muted-foreground"
                  onClick={startEditing}
                >
                  <Edit2 className="size-3" />
                  Edit Draft
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isUpdating}
                    onClick={() => reviewDraft(draft.id, "reject")}
                    className="gap-1"
                  >
                    <XCircle className="size-3" />
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    disabled={isUpdating || draft.status === "approved"}
                    onClick={() => reviewDraft(draft.id, "approve")}
                    className="gap-1"
                  >
                    <CheckCircle2 className="size-3" />
                    Approve
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

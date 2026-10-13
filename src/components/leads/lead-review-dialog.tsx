"use client"

import * as React from "react"
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Mail,
  Send,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { isValidPersonName } from "@/lib/gtm-contact-matcher"
import { checkLeadQualificationGates } from "@/lib/gtm-qualification-gates"
import { formatErrorMessage } from "@/lib/gtm-error-formatter"
import { LeadStatusBadge, VerificationBadge } from "./lead-badges"
import type { Lead } from "./types"

/** The lead's draft subject/body, falling back to the campaign's draft list if not cached on the row. */
async function loadDraftContent(lead: Lead) {
  if (lead.draftSubject || lead.draftBody) {
    return { subject: lead.draftSubject || "", body: lead.draftBody || "" }
  }
  try {
    const res = await fetch(`/api/gtm/campaigns/${lead.campaignId}/drafts`)
    const data = await res.json()
    const found = data.drafts?.find(
      (d: { id: string; contact?: { id: string } }) =>
        d.id === lead.draftId || d.contact?.id === lead.id
    )
    if (found) return { subject: found.subject || "", body: found.body || "" }
  } catch {
    // fall through to whatever the row has
  }
  return { subject: lead.draftSubject || "", body: lead.draftBody || "" }
}

async function postJson(url: string, body: unknown, fallbackError: string) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || fallbackError)
}

function BlockedNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
      <AlertCircle className="size-4 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

/**
 * Stage 6 review for one lead's draft: edit, then reject, approve, or approve
 * and send immediately through the connected mailbox.
 */
export function LeadReviewDialog({
  lead,
  onClose,
  onChanged,
}: {
  lead: Lead | null
  onClose: () => void
  onChanged: () => Promise<void> | void
}) {
  const [subject, setSubject] = React.useState("")
  const [body, setBody] = React.useState("")
  const [isPending, setIsPending] = React.useState(false)

  React.useEffect(() => {
    if (!lead) return
    let cancelled = false
    loadDraftContent(lead).then((draft) => {
      if (cancelled) return
      setSubject(draft.subject)
      setBody(draft.body)
    })
    return () => {
      cancelled = true
    }
  }, [lead])

  /** Runs one review action, then closes the dialog and refreshes the table. */
  const run = async (
    action: () => Promise<void>,
    successMessage: string,
    fallbackError: string
  ) => {
    setIsPending(true)
    try {
      await action()
      toast.success(successMessage)
      onClose()
      await onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : fallbackError)
    } finally {
      setIsPending(false)
    }
  }

  const draftUrl = lead?.draftId
    ? `/api/gtm/campaigns/${lead.campaignId}/drafts/${lead.draftId}`
    : null

  const reject = () =>
    run(
      async () => {
        if (draftUrl)
          await postJson(
            draftUrl,
            { action: "reject" },
            "Failed to reject draft"
          )
      },
      "Draft rejected",
      "Failed to reject draft"
    )

  const approve = () =>
    run(
      async () => {
        if (draftUrl) {
          await postJson(
            draftUrl,
            { action: "approve", edits: { subject, body } },
            "Failed to approve draft"
          )
        }
      },
      "Draft approved",
      "Failed to approve draft"
    )

  const send = () => {
    if (!lead) return
    if (!isValidPersonName(lead.name)) {
      toast.error(`Sending blocked: "${lead.name}" is not a valid person name.`)
      return
    }
    const gate = checkLeadQualificationGates(lead)
    if (!gate.qualified) {
      toast.error(`Sending blocked: ${gate.reason}`)
      return
    }
    run(
      () =>
        postJson(
          `/api/gtm/leads/${lead.id}/send`,
          { approveFirst: true, edits: { subject, body } },
          "Failed to dispatch email"
        ),
      `Email sent via Gmail to ${lead.email || lead.name}`,
      "Failed to dispatch email"
    )
  }

  const nameValid = lead ? isValidPersonName(lead.name) : false
  const gate = lead ? checkLeadQualificationGates(lead) : { qualified: false }

  return (
    <Dialog open={!!lead} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Mail className="size-4 text-primary" />
            Review & Send Outreach Email
          </DialogTitle>
          <DialogDescription className="text-xs">
            Review and customize the AI-generated draft before dispatching
            through your connected Gmail mailbox.
          </DialogDescription>
        </DialogHeader>

        {lead && (
          <div className="space-y-4 pt-2">
            <div className="space-y-2 rounded-lg border border-border/60 bg-muted/40 p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {lead.name}
                  </span>
                  <span className="text-muted-foreground">— {lead.title}</span>
                </div>
                <LeadStatusBadge lead={lead} />
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <div>
                  <span className="font-medium text-foreground">Company: </span>
                  {lead.companyName}
                </div>
                <div>
                  <span className="font-medium text-foreground">Email: </span>
                  <span className="font-mono text-foreground">
                    {lead.email || "No email available"}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-foreground">
                    Campaign:{" "}
                  </span>
                  {lead.campaignName}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="lead-review-subject"
                  className="text-xs font-semibold text-foreground"
                >
                  Subject Line
                </label>
                <Input
                  id="lead-review-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject line..."
                  className="text-xs font-medium"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="lead-review-body"
                  className="text-xs font-semibold text-foreground"
                >
                  Email Body
                </label>
                <Textarea
                  id="lead-review-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={8}
                  placeholder="Email body..."
                  className="resize-y font-sans text-xs leading-relaxed"
                />
              </div>
            </div>

            {!nameValid && (
              <BlockedNotice>
                <strong>Sending Blocked:</strong> &quot;{lead.name}&quot; is not
                a valid individual name (pending re-discovery). Real outreach is
                disabled for this lead.
              </BlockedNotice>
            )}
            {!gate.qualified && (
              <BlockedNotice>
                <strong>Sending Blocked:</strong> {gate.reason}. Real outreach
                is disabled for this lead.
              </BlockedNotice>
            )}
            {Boolean(lead.rejectionReason) && nameValid && gate.qualified && (
              <BlockedNotice>
                <strong>Previous dispatch note:</strong>{" "}
                {formatErrorMessage(lead.rejectionReason).formattedMessage}
              </BlockedNotice>
            )}

            <div className="flex flex-col items-center justify-between gap-2 border-t border-border/60 pt-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={reject}
                disabled={isPending}
                className="h-8 w-full gap-1.5 border-rose-500/30 text-xs text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 sm:w-auto"
              >
                <XCircle className="size-3.5" />
                Reject Draft
              </Button>

              <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={approve}
                  disabled={isPending}
                  className="h-8 gap-1.5 border-emerald-500/40 text-xs text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
                >
                  <CheckCircle2 className="size-3.5" />
                  Save & Approve
                </Button>

                <div className="flex items-center gap-1.5 rounded border border-border/40 bg-muted/60 px-2 py-1 text-xs">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Confidence:
                  </span>
                  <VerificationBadge status={lead.verificationStatus} />
                </div>

                <Button
                  type="button"
                  size="sm"
                  onClick={send}
                  disabled={
                    isPending || !lead.email || !nameValid || !gate.qualified
                  }
                  className="h-8 gap-1.5 text-xs shadow-sm"
                  title={
                    !nameValid
                      ? "Sending blocked: Contact name is invalid (pending re-discovery)"
                      : !gate.qualified
                        ? `Sending blocked: ${gate.reason}`
                        : undefined
                  }
                >
                  {isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Send className="size-3.5" />
                  )}
                  Send via Gmail
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

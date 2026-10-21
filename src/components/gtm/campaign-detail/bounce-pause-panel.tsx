"use client"

import * as React from "react"
import { AlertTriangleSolid } from "@/components/icons/status"
import { Button } from "@/components/ui/button"
import { DataTable, TextCell, type DataTableColumn } from "@/components/ui/data-table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { deliveryCounts, PAUSED_BOUNCE_RATE, planBounceRecovery } from "@/lib/contact-import/bounce-guard"
import { BOUNCE_COPY as COPY, deliveryText } from "@/lib/contact-import/copy"
import { toDeliveryDraft } from "./delivery"
import { useCampaignDetail } from "./campaign-detail-root"
import type { Draft } from "./types"

/**
 * Shown while an imported-list campaign is paused for bounces: the rate that
 * tripped the pause, the bounced addresses, and the one way forward (remove
 * them and resume), behind a confirm that says what changes and that the 5%
 * rule starts over. Renders nothing for any other campaign.
 */
export function BouncePausePanel() {
  const { data, drafts, resumeAfterBounces, isDispatching } = useCampaignDetail()
  const [confirming, setConfirming] = React.useState(false)
  if (data.campaign.status !== PAUSED_BOUNCE_RATE) return null

  const guardDrafts = drafts.map(toDeliveryDraft)
  // The same count the pause check uses: since the last resume, if there was one.
  const since = data.campaign.bounceGuardSince ?? null
  const stats = deliveryCounts(guardDrafts, since)
  const plan = planBounceRecovery(guardDrafts)
  const bounced = drafts.filter((d) => d.hasBounced)
  const removeCount = plan.bouncedContactIds.length

  const columns: DataTableColumn<Draft>[] = [
    { id: "name", header: "Name", type: "text", cell: (d) => <TextCell value={d.contact.name} className="font-medium text-fg-strong" />, sortValue: (d) => d.contact.name },
    // Addresses wrap instead of truncating: the user checks each one before removing it.
    { id: "email", header: "Email", type: "text", className: "min-w-48", cell: (d) => <span className="block whitespace-normal [overflow-wrap:anywhere]">{d.contact.email}</span>, sortValue: (d) => d.contact.email },
    { id: "company", header: "Company", type: "text", cell: (d) => <TextCell value={d.company.name} muted />, sortValue: (d) => d.company.name },
  ]

  const confirm = async () => {
    if (await resumeAfterBounces()) setConfirming(false)
  }

  return (
    <section aria-labelledby="bounce-pause-title" className="flex flex-col gap-4 rounded-xl border border-transparent bg-surface p-4 shadow-surface">
      <div className="flex flex-col gap-1">
        <h2 id="bounce-pause-title" className="flex items-center gap-1.5 text-section text-fg-strong">
          <AlertTriangleSolid className="size-4 text-warning" />
          {COPY.title}
        </h2>
        <p className="text-body text-fg-default tabular-nums">
          {since ? `${COPY.sinceResume} ` : ""}
          {deliveryText(stats)}
        </p>
        <p className="text-body text-fg-muted">{COPY.rule}</p>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-body font-medium text-fg-strong tabular-nums">
          {COPY.listTitle} ({bounced.length})
        </h3>
        <DataTable label={COPY.listTitle} columns={columns} rows={bounced} rowKey={(d) => d.id} density="compact" />
      </div>

      {removeCount > 0 && (
        <div className="flex justify-end border-t border-border pt-4">
          <Button variant="brand" onClick={() => setConfirming(true)}>
            {COPY.removeAction(removeCount)}
          </Button>
        </div>
      )}

      <Dialog open={confirming} onOpenChange={(open) => !isDispatching && setConfirming(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{COPY.confirmTitle(removeCount)}</DialogTitle>
            <DialogDescription>{COPY.confirmRemoves}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 text-body text-fg-default">
            <p>
              {plan.next === "send"
                ? COPY.confirmSends(plan.approvedRemaining)
                : plan.next === "review"
                  ? COPY.confirmReview
                  : COPY.confirmNothing}
            </p>
            {plan.next === "send" && <p>{COPY.confirmRule}</p>}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={isDispatching}>
              {COPY.cancel}
            </Button>
            <Button variant="brand" onClick={confirm} loading={isDispatching}>
              {COPY.confirmAction}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}

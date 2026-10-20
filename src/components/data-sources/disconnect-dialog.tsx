"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DATA_SOURCE_COPY as COPY } from "@/lib/data-sources/copy"

/** Confirm before the key is deleted: the title names the action, the body the consequence. */
export function DisconnectDialog({
  open,
  onOpenChange,
  onConfirm,
  submitting,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  submitting: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{COPY.disconnectTitle}</DialogTitle>
          <DialogDescription>{COPY.disconnectBody}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={submitting}>
            {COPY.cancelAction}
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={submitting}>
            {COPY.disconnectAction}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

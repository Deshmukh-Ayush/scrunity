"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { IMPORT_COPY as COPY } from "@/lib/contact-import/copy"
import type { PublicImport } from "@/lib/contact-import/types"

/** Confirm before a list is deleted: what goes, and that people already emailed stay. */
export function DeleteListDialog({
  list,
  onOpenChange,
  onConfirm,
  submitting,
}: {
  list: PublicImport | null
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  submitting: boolean
}) {
  return (
    <Dialog open={list !== null} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent>
        {list && (
          <>
            <DialogHeader>
              <DialogTitle className="break-words">{COPY.deleteTitle(list.fileName)}</DialogTitle>
              <DialogDescription>
                {COPY.deleteBody} {list.emailedCount > 0 && COPY.deleteKeepsSent(list.emailedCount)}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={submitting}>
                {COPY.cancelAction}
              </Button>
              <Button variant="danger" onClick={onConfirm} loading={submitting}>
                {COPY.deleteConfirm}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

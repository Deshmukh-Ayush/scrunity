"use client"

import Link from "next/link"
import { Button, buttonVariants } from "@/components/ui/button"
import { CheckCircleSolid } from "@/components/icons/status"
import { Download } from "@/components/ui/icons"
import { IMPORT_COPY as COPY } from "@/lib/contact-import/copy"
import type { ImportReviewResult } from "@/lib/contact-import/types"
import { cn } from "@/lib/utils"
import { ImportCounts } from "./import-counts"
import { RejectedTable } from "./review-step"

/** Step 4: what was imported, the rejected rows to download, and where to go next. */
export function SummaryStep({
  result,
  onDownload,
  onAnother,
}: {
  result: ImportReviewResult
  onDownload: () => void
  onAnother: () => void
}) {
  return (
    <div className="flex flex-col gap-6">
      <section
        aria-labelledby="summary-title"
        role="status"
        className="flex flex-col gap-4 rounded-xl border border-transparent bg-surface p-4 shadow-surface"
      >
        <div className="flex flex-col gap-1">
          <h2 id="summary-title" className="flex items-center gap-1.5 text-section text-fg-strong">
            <CheckCircleSolid className="size-4 text-success" />
            {COPY.summaryTitle}
          </h2>
          <p className="text-body text-fg-default">{COPY.summaryText(result.counts.imported, result.fileName)}</p>
          <p className="text-body text-fg-muted">{COPY.emailStatus}.</p>
        </div>
        <ImportCounts counts={result.counts} />
      </section>

      {result.rejected.length > 0 && (
        <section aria-label="Rejected rows" className="flex flex-col gap-3">
          <div>
            <Button variant="secondary" size="sm" onClick={onDownload}>
              <Download data-icon="inline-start" />
              {COPY.downloadRejected(result.rejected.length)}
            </Button>
          </div>
          <RejectedTable result={result} />
        </section>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button variant="ghost" onClick={onAnother}>
          {COPY.importAnother}
        </Button>
        <Link href="/dashboard/campaigns/new" className={cn(buttonVariants({ variant: "brand" }))}>
          {COPY.startCampaign}
        </Link>
      </div>
    </div>
  )
}

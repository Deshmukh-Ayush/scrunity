"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { DataTable, NumberCell, TextCell, type DataTableColumn } from "@/components/ui/data-table"
import { AlertCircle, Download, Info } from "@/components/ui/icons"
import { IMPORT_COPY as COPY, REJECT_REASON_TEXT } from "@/lib/contact-import/copy"
import type { RejectedRow } from "@/lib/contact-import/review"
import type { ImportReviewResult } from "@/lib/contact-import/types"
import { ImportCounts } from "./import-counts"

/** The rejected rows: row number, reason, then the row's first two values for recognition. */
export function RejectedTable({ result }: { result: ImportReviewResult }) {
  const columns: DataTableColumn<RejectedRow>[] = [
    { id: "row", header: "Row", type: "number", className: "w-16", cell: (r) => <NumberCell value={r.rowNumber} />, sortValue: (r) => r.rowNumber },
    // The reason wraps instead of truncating: it is what the user came to read.
    { id: "reason", header: "Reason", type: "text", className: "min-w-56", cell: (r) => <span className="block whitespace-normal">{REJECT_REASON_TEXT[r.reason]}</span>, sortValue: (r) => r.reason },
    ...result.headers.slice(0, 2).map((header, i): DataTableColumn<RejectedRow> => ({
      id: `c${i}`,
      header,
      type: "text",
      className: "min-w-32 max-w-60",
      cell: (r) => <TextCell value={r.cells[i]} muted />,
    })),
  ]
  return <DataTable label="Rejected rows" columns={columns} rows={result.rejected} rowKey={(r) => String(r.rowNumber)} density="compact" />
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-body text-fg-default">
      <Info className="mt-0.5 size-4 shrink-0 text-fg-muted" />
      <span>{children}</span>
    </p>
  )
}

/**
 * Step 3: the dry run. Counts, warnings in plain words (personal emails,
 * missing names), the rejected rows with a download, then the attestation
 * checkbox and the one brand action. Import is never disabled by the
 * checkbox: pressing it unchecked says why, next to the checkbox.
 */
export function ReviewStep({
  result,
  attested,
  onAttest,
  onImport,
  onBack,
  onDownload,
  busy,
  error,
  attestError,
}: {
  result: ImportReviewResult
  attested: boolean
  onAttest: (value: boolean) => void
  onImport: () => void
  onBack: () => void
  onDownload: () => void
  busy: boolean
  error: string | null
  attestError: boolean
}) {
  const { counts } = result
  const checkboxRef = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => {
    if (attestError) checkboxRef.current?.focus()
  }, [attestError])
  const nothing = counts.imported === 0

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="review-title" className="flex flex-col gap-4 rounded-xl border border-transparent bg-surface p-4 shadow-surface">
        <div className="flex flex-col gap-1">
          <h2 id="review-title" className="text-section text-fg-strong">
            {COPY.reviewTitle}
          </h2>
          <p className="text-body text-fg-muted">{result.fileName}</p>
        </div>
        <ImportCounts counts={counts} />
        {(counts.personalEmails > 0 || counts.missingNames > 0 || counts.noEmail > 0 || nothing) && (
          <div className="flex flex-col gap-2 border-t border-border pt-4">
            {nothing && <Note>{COPY.nothingToImport}</Note>}
            {counts.noEmail > 0 && <Note>{COPY.noEmailNote(counts.noEmail)}</Note>}
            {counts.personalEmails > 0 && <Note>{COPY.personalNote(counts.personalEmails)}</Note>}
            {counts.missingNames > 0 && <Note>{COPY.missingNameNote(counts.missingNames)}</Note>}
          </div>
        )}
      </section>

      {result.rejected.length > 0 && (
        <section aria-labelledby="rejected-title" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="rejected-title" className="text-section text-fg-strong tabular-nums">
              Rejected rows
            </h2>
            <Button variant="secondary" size="sm" onClick={onDownload}>
              <Download data-icon="inline-start" />
              {COPY.downloadRejected(result.rejected.length)}
            </Button>
          </div>
          <RejectedTable result={result} />
        </section>
      )}

      {!nothing && (
        <div className="flex flex-col gap-1.5">
          <label className="flex items-start gap-2.5 text-body text-fg-default">
            <input
              ref={checkboxRef}
              type="checkbox"
              checked={attested}
              onChange={(e) => onAttest(e.target.checked)}
              aria-invalid={attestError || undefined}
              aria-describedby={attestError ? "attest-error" : undefined}
              className="mt-0.5 size-4 shrink-0 cursor-pointer accent-foreground"
            />
            <span>{COPY.attestationLabel}</span>
          </label>
          {attestError && (
            <p id="attest-error" role="alert" className="ps-6.5 text-body text-danger">
              {COPY.attestationRequired}
            </p>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="flex items-start gap-1.5 text-body text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        <Button variant="ghost" onClick={onBack} disabled={busy}>
          {COPY.backAction}
        </Button>
        {!nothing && (
          <Button variant="brand" onClick={onImport} loading={busy}>
            {busy ? COPY.importing : COPY.importAction(counts.imported)}
          </Button>
        )}
      </div>
    </div>
  )
}

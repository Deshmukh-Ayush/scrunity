"use client"

import { Button } from "@/components/ui/button"
import { DataTable, TextCell, type DataTableColumn } from "@/components/ui/data-table"
import { AlertCircle } from "@/components/ui/icons"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { IMPORT_FIELDS, IMPORT_FIELD_LABELS, mappingProblem, type ColumnMapping, type ImportField } from "@/lib/contact-import/columns"
import { IMPORT_COPY as COPY } from "@/lib/contact-import/copy"
import type { ImportPreview } from "@/lib/contact-import/types"

const IGNORE = "__ignore"
const FIELD_ITEMS = [{ value: IGNORE, label: COPY.ignoreOption }, ...IMPORT_FIELDS.map((f) => ({ value: f, label: IMPORT_FIELD_LABELS[f] }))]

interface SampleRow {
  index: number
  cells: string[]
}

/**
 * Step 2: what each column holds. One row per file column: its header, a
 * field select (or Ignore) and its first value; then the first 10 rows in a
 * DataTable. Cells are plain text (React escapes them). The required-field
 * rule is checked as the user changes the mapping, and Continue stays
 * available so pressing it explains what is missing.
 */
export function MappingStep({
  preview,
  mapping,
  onChange,
  onBack,
  onContinue,
  busy,
  error,
}: {
  preview: ImportPreview
  mapping: ColumnMapping
  onChange: (index: number, field: ImportField | null) => void
  onBack: () => void
  onContinue: () => void
  busy: boolean
  /** A server error from the review request, or the required-field message after Continue. */
  error: string | null
}) {
  const problem = mappingProblem(mapping)
  const problemText = problem === "duplicate_field" ? COPY.duplicateField : problem ? COPY.missingIdentity : null

  const columns: DataTableColumn<SampleRow>[] = preview.headers.map((header, i) => ({
    id: `c${i}`,
    header,
    type: "text",
    className: "min-w-32 max-w-60",
    cell: (row) => <TextCell value={row.cells[i]} muted={mapping[i] === null} />,
  }))

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="mapping-title" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="mapping-title" className="text-section text-fg-strong">
            {COPY.mapTitle}
          </h2>
          <p className="text-body text-fg-muted">
            {COPY.mapDescription} <span className="tabular-nums">{preview.fileName}</span>
          </p>
        </div>
        <div className="rounded-xl border border-transparent bg-surface shadow-surface">
          <div aria-hidden="true" className="hidden grid-cols-[minmax(0,1fr)_12rem_minmax(0,1fr)] gap-3 border-b border-border px-4 py-2 text-meta text-fg-muted sm:grid">
            <span>{COPY.mapColumnHeader}</span>
            <span>{COPY.mapFieldHeader}</span>
            <span>{COPY.mapSampleHeader}</span>
          </div>
          <ul aria-label={COPY.mapTitle} className="divide-y divide-border">
            {preview.headers.map((header, i) => {
              const id = `map-${i}`
              const sample = preview.sample.find((r) => r[i])?.[i] ?? ""
              return (
                <li key={id} className="grid grid-cols-1 gap-1.5 px-4 py-2.5 sm:grid-cols-[minmax(0,1fr)_12rem_minmax(0,1fr)] sm:items-center sm:gap-3">
                  <label htmlFor={id} className="min-w-0 truncate text-body font-medium text-fg-strong" title={header}>
                    {header}
                  </label>
                  <Select
                    items={FIELD_ITEMS}
                    value={mapping[i] ?? IGNORE}
                    onValueChange={(value) => onChange(i, value && value !== IGNORE ? (value as ImportField) : null)}
                  >
                    <SelectTrigger id={id} className="w-full" aria-describedby={`${id}-sample`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_ITEMS.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span id={`${id}-sample`} className="min-w-0 truncate text-body text-fg-muted" title={sample}>
                    <span className="sr-only">{COPY.mapSampleHeader}: </span>
                    {sample || "—"}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      <section aria-labelledby="preview-title" className="flex flex-col gap-3">
        <h2 id="preview-title" className="text-section text-fg-strong tabular-nums">
          {COPY.previewTitle(preview.sample.length)}
        </h2>
        <DataTable
          label={COPY.previewTitle(preview.sample.length)}
          columns={columns}
          rows={preview.sample.map((cells, index) => ({ index, cells }))}
          rowKey={(row) => String(row.index)}
          density="compact"
        />
      </section>

      {(error || problemText) && (
        <p id="mapping-error" role={error ? "alert" : "status"} className="flex items-start gap-1.5 text-body text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error ?? problemText}</span>
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button variant="ghost" onClick={onBack} disabled={busy}>
          {COPY.backAction}
        </Button>
        <Button variant="brand" onClick={onContinue} loading={busy} aria-describedby={problemText || error ? "mapping-error" : undefined}>
          {busy ? COPY.reviewChecking : COPY.continueAction}
        </Button>
      </div>
    </div>
  )
}

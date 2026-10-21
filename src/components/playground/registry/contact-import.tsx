"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { DeleteListDialog } from "@/components/contact-import/delete-list-dialog"
import { ImportedLists } from "@/components/contact-import/imported-lists"
import { ImportSteps, type ImportStepId } from "@/components/contact-import/import-steps"
import { MappingStep } from "@/components/contact-import/mapping-step"
import { ReviewStep } from "@/components/contact-import/review-step"
import { SummaryStep } from "@/components/contact-import/summary-step"
import { UploadStep } from "@/components/contact-import/upload-step"
import { LaunchFooter } from "@/components/gtm/new-campaign/launch-footer"
import { chosenImport, SourceChoice, type CampaignSource, type SourceStatus } from "@/components/gtm/new-campaign/source-choice"
import { importErrorText } from "@/lib/contact-import/copy"
import type { ColumnMapping, ImportField } from "@/lib/contact-import/columns"
import type { ImportPreview } from "@/lib/contact-import/types"
import { IMPORTED, LISTS, PREVIEW, PREVIEW_MISSING, PREVIEW_WIDE, REVIEW, REVIEW_NOTHING } from "./contact-import-fixtures"
import type { ShowcaseEntry } from "./types"

const noop = () => {}
const limits = { maxMb: 5, maxRows: 2000 }

function State({ id, label, step, children }: { id: string; label: string; step?: ImportStepId; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3" data-demo-state={id}>
      <p className="text-meta text-fg-muted">{label}</p>
      {step && <ImportSteps current={step} />}
      {children}
    </div>
  )
}

function Mapping({ preview, error = null, busy = false }: { preview: ImportPreview; error?: string | null; busy?: boolean }) {
  const [mapping, setMapping] = React.useState<ColumnMapping>(preview.mapping)
  const change = (index: number, field: ImportField | null) => setMapping((m) => m.map((f, i) => (i === index ? field : f === field && field !== null ? null : f)))
  return <MappingStep preview={preview} mapping={mapping} onChange={change} onBack={noop} onContinue={noop} busy={busy} error={error} />
}

function Review({ result = REVIEW, busy = false, attestError = false }: { result?: typeof REVIEW; busy?: boolean; attestError?: boolean }) {
  const [attested, setAttested] = React.useState(busy)
  return (
    <ReviewStep result={result} attested={attested} onAttest={setAttested} onImport={noop} onBack={noop} onDownload={noop} busy={busy} error={null} attestError={attestError && !attested} />
  )
}

/** Every import state from fixtures; nothing here sends a request. */
export function ContactImportStates() {
  return (
    <div className="flex w-full max-w-4xl flex-col gap-12">
      <State id="upload_empty" label="Upload: nothing chosen yet" step="upload">
        <UploadStep busy={false} error={null} onFile={noop} {...limits} />
      </State>
      <State id="uploading" label="Uploading (reading the file)" step="upload">
        <UploadStep busy error={null} onFile={noop} {...limits} />
      </State>
      <State id="not_csv" label="Not a CSV" step="upload">
        <UploadStep busy={false} error={importErrorText({ code: "not_csv" }, limits)} onFile={noop} {...limits} />
      </State>
      <State id="too_large" label="File too large" step="upload">
        <UploadStep busy={false} error={importErrorText({ code: "too_large" }, limits)} onFile={noop} {...limits} />
      </State>
      <State id="too_many_rows" label="Too many rows" step="upload">
        <UploadStep busy={false} error={importErrorText({ code: "too_many_rows", rows: 3412 }, limits)} onFile={noop} {...limits} />
      </State>
      <State id="parse_error" label="Parse error (unclosed quote)" step="upload">
        <UploadStep busy={false} error={importErrorText({ code: "parse_error", line: 118 }, limits)} onFile={noop} {...limits} />
      </State>
      <State id="mapping" label="Mapping: columns detected automatically" step="map">
        <Mapping preview={PREVIEW} />
      </State>
      <State id="missing_column" label="Mapping: missing required column" step="map">
        <Mapping preview={PREVIEW_MISSING} />
      </State>
      <State id="mapping_wide" label="Mapping: 40 columns and a 300-character cell" step="map">
        <Mapping preview={PREVIEW_WIDE} />
      </State>
      <State id="review_warnings" label="Review with warnings and rejected rows" step="review">
        <Review />
      </State>
      <State id="attestation_missing" label="Review: Import pressed without the confirmation" step="review">
        <Review attestError />
      </State>
      <State id="review_nothing" label="Review: no row can be imported" step="review">
        <Review result={REVIEW_NOTHING} />
      </State>
      <State id="importing" label="Importing" step="review">
        <Review busy />
      </State>
      <State id="summary" label="Summary" step="done">
        <SummaryStep result={IMPORTED} onDownload={noop} onAnother={noop} />
      </State>
    </div>
  )
}

export function ImportedListsStates() {
  const [open, setOpen] = React.useState(false)
  const slowDelete = () => new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 800))
  return (
    <div className="flex w-full max-w-3xl flex-col gap-12">
      <State id="lists_empty" label="No imports yet">
        <ImportedLists initialImports={[]} canManage onDelete={slowDelete} />
      </State>
      <State id="lists" label="Two lists (Delete list opens the confirm)">
        <ImportedLists initialImports={LISTS} canManage onDelete={slowDelete} />
      </State>
      <State id="lists_member" label="A member's view (no actions)">
        <ImportedLists initialImports={LISTS} canManage={false} />
      </State>
      <State id="delete_confirm" label="Delete confirm (a list with people already emailed)">
        <div>
          <Button onClick={() => setOpen(true)} data-demo-open="delete-list">
            Open delete confirm
          </Button>
        </div>
        <DeleteListDialog list={open ? LISTS[0] : null} onOpenChange={setOpen} onConfirm={() => setOpen(false)} submitting={false} />
      </State>
    </div>
  )
}

const estimate = { provider: "apollo" as const, maxCreditsPerCampaign: 21, runCap: 25 }
const SOURCE_STATES: Array<{ id: string; label: string; status: SourceStatus; source: CampaignSource; selected: number }> = [
  { id: "source_apollo", label: "Apollo connected and two lists: search chosen", status: { access: "customer", imports: LISTS }, source: { kind: "search" }, selected: 2 },
  { id: "source_import", label: "Apollo connected, imported list chosen", status: { access: "customer", imports: LISTS }, source: { kind: "import", importId: LISTS[0].id }, selected: 1 },
  { id: "source_import_two_segments", label: "Imported list with two segments selected", status: { access: "not_connected", imports: LISTS }, source: { kind: "import", importId: LISTS[0].id }, selected: 2 },
  { id: "source_no_apollo", label: "No Apollo, one list: the list is chosen for you", status: { access: "not_connected", imports: LISTS.slice(1) }, source: { kind: "import", importId: LISTS[1].id }, selected: 1 },
  { id: "source_nothing", label: "No Apollo and no lists: start blocked", status: { access: "not_connected", imports: [] }, source: { kind: "search" }, selected: 1 },
]

function SourceDemo({ status, initial, selected }: { status: SourceStatus; initial: CampaignSource; selected: number }) {
  const [source, setSource] = React.useState(initial)
  return (
    <div className="flex flex-col gap-4">
      <SourceChoice status={status} source={source} onChange={setSource} />
      <div className="[&>div]:static">
        <LaunchFooter
          selected={selected}
          isLaunching={false}
          onLaunch={noop}
          dataSource={{ ...status, estimate, needsReconnect: false }}
          importList={chosenImport(status, source)}
        />
      </div>
    </div>
  )
}

export function SourceChoiceStates() {
  return (
    <div className="flex w-full max-w-[720px] flex-col gap-12">
      {SOURCE_STATES.map((s) => (
        <State key={s.id} id={s.id} label={s.label}>
          <SourceDemo status={s.status} initial={s.source} selected={s.selected} />
        </State>
      ))}
    </div>
  )
}

export const contactImportEntry: ShowcaseEntry = {
  id: "contact-import",
  name: "Import a list: every state",
  group: "Flows",
  description:
    "Upload (empty, uploading, not a CSV, too large, too many rows, parse error), match columns (detected, missing required column, 40 columns with a 300-character cell), review (warnings, missing confirmation, nothing to import, importing) and the summary. Fixtures only; cells render as plain text.",
  render: () => <ContactImportStates />,
}

export const importedListsEntry: ShowcaseEntry = {
  id: "imported-lists",
  name: "Data sources: imported lists",
  group: "Settings",
  description: "Empty, two lists, a member's read-only view, and the delete confirm that says people already emailed stay.",
  render: () => <ImportedListsStates />,
}

export const sourceChoiceEntry: ShowcaseEntry = {
  id: "campaign-source-choice",
  name: "New research run: where people come from",
  group: "Flows",
  description: "Find with Apollo or use an imported list, with the footer for each: one segment per list, and a blocked start when neither is set up.",
  render: () => <SourceChoiceStates />,
}

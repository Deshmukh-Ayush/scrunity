"use client"

import * as React from "react"
import { CSV_IMPORT_MAX_BYTES, looksLikeCsv } from "@/lib/contact-import/limits"
import { IMPORT_COPY as COPY, importErrorText } from "@/lib/contact-import/copy"
import { mappingProblem, type ColumnMapping, type ImportField } from "@/lib/contact-import/columns"
import { rejectedFileName, rejectedRowsCsv } from "@/lib/contact-import/export"
import type { ImportErrorBody, ImportPreview, ImportReviewResult } from "@/lib/contact-import/types"
import { MappingStep } from "./mapping-step"
import { ReviewStep } from "./review-step"
import { ImportSteps, type ImportStepId } from "./import-steps"
import { SummaryStep } from "./summary-step"
import { UploadStep } from "./upload-step"

type Outcome<T> = { ok: true; value: T } | { ok: false; error: ImportErrorBody }

const isErrorBody = (v: unknown): v is { error: ImportErrorBody } =>
  typeof v === "object" && v !== null && typeof (v as { error?: { code?: unknown } }).error?.code === "string"

/** One POST to the import API: the file is sent again for every step and never kept by the server. */
async function postImport<T>(file: File, intent: "preview" | "review" | "import", extra: Record<string, string> = {}): Promise<Outcome<T>> {
  const form = new FormData()
  form.set("file", file)
  form.set("intent", intent)
  for (const [k, v] of Object.entries(extra)) form.set(k, v)
  try {
    const res = await fetch("/api/gtm/data-sources/imports", { method: "POST", body: form })
    const body: unknown = await res.json().catch(() => null)
    if (res.ok) return { ok: true, value: body as T }
    return { ok: false, error: isErrorBody(body) ? body.error : { code: "import_failed" } }
  } catch {
    return { ok: false, error: { code: "import_failed" } }
  }
}

/** Saves text as a file from the browser; nothing goes to the server. */
export function downloadText(fileName: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }))
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/**
 * The CSV import, on its own route (/dashboard/settings/data-sources/import):
 * upload, match columns, review, done. A route rather than a dialog because
 * the mapping list and the preview table need the page width, and a 40-column
 * file in a dialog would scroll inside a scroll on a phone.
 */
export function ImportFlow({ maxRows, maxMb }: { maxRows: number; maxMb: number }) {
  const [step, setStep] = React.useState<ImportStepId>("upload")
  const [file, setFile] = React.useState<File | null>(null)
  const [preview, setPreview] = React.useState<ImportPreview | null>(null)
  const [mapping, setMapping] = React.useState<ColumnMapping>([])
  const [result, setResult] = React.useState<ImportReviewResult | null>(null)
  const [attested, setAttested] = React.useState(false)
  const [attestError, setAttestError] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const headingRef = React.useRef<HTMLHeadingElement>(null)
  const limits = { maxMb, maxRows }

  const go = (next: ImportStepId) => {
    setStep(next)
    setError(null)
    // Move focus to the step heading so keyboard and screen-reader users land on the new step.
    requestAnimationFrame(() => headingRef.current?.focus())
  }

  const choose = async (picked: File) => {
    setError(null)
    if (!looksLikeCsv(picked.name, picked.type)) return setError(importErrorText({ code: "not_csv" }, limits))
    if (picked.size > CSV_IMPORT_MAX_BYTES) return setError(importErrorText({ code: "too_large" }, limits))
    setBusy(true)
    const out = await postImport<ImportPreview>(picked, "preview")
    setBusy(false)
    if (!out.ok) return setError(importErrorText(out.error, limits))
    setFile(picked)
    setPreview(out.value)
    setMapping(out.value.mapping)
    go("map")
  }

  const review = async () => {
    if (!file) return
    if (mappingProblem(mapping)) return setError(importErrorText({ code: mappingProblem(mapping) ?? "missing_identity" }, limits))
    setBusy(true)
    const out = await postImport<ImportReviewResult>(file, "review", { mapping: JSON.stringify(mapping) })
    setBusy(false)
    if (!out.ok) return setError(importErrorText(out.error, limits))
    setResult(out.value)
    setAttested(false)
    setAttestError(false)
    go("review")
  }

  const runImport = async () => {
    if (!file) return
    if (!attested) return setAttestError(true)
    setBusy(true)
    const out = await postImport<ImportReviewResult>(file, "import", { mapping: JSON.stringify(mapping), attested: "true" })
    setBusy(false)
    if (!out.ok) {
      if (out.error.code === "attestation_required") return setAttestError(true)
      return setError(importErrorText(out.error, limits))
    }
    setResult(out.value)
    go("done")
  }

  const restart = () => {
    setFile(null)
    setPreview(null)
    setResult(null)
    go("upload")
  }

  const download = () => result && downloadText(rejectedFileName(result.fileName), rejectedRowsCsv(result.headers, result.rejected))

  return (
    <div className="flex flex-col gap-6">
      <ImportSteps current={step} headingRef={headingRef} />
      {step === "upload" && <UploadStep busy={busy} error={error} onFile={choose} maxMb={maxMb} maxRows={maxRows} />}
      {step === "map" && preview && (
        <MappingStep
          preview={preview}
          mapping={mapping}
          onChange={(index: number, field: ImportField | null) => {
            setError(null)
            setMapping((m) => m.map((f, i) => (i === index ? field : f === field && field !== null ? null : f)))
          }}
          onBack={restart}
          onContinue={review}
          busy={busy}
          error={error}
        />
      )}
      {step === "review" && result && (
        <ReviewStep
          result={result}
          attested={attested}
          onAttest={(v) => {
            setAttested(v)
            if (v) setAttestError(false)
          }}
          onImport={runImport}
          onBack={() => go("map")}
          onDownload={download}
          busy={busy}
          error={error}
          attestError={attestError}
        />
      )}
      {step === "done" && result && <SummaryStep result={result} onDownload={download} onAnother={restart} />}
      <p className="sr-only" aria-live="polite">
        {busy ? (step === "upload" ? COPY.readingFile : step === "map" ? COPY.reviewChecking : COPY.importing) : ""}
      </p>
    </div>
  )
}

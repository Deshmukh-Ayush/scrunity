"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { AlertCircle, UploadCloud } from "@/components/ui/icons"
import { IMPORT_COPY as COPY } from "@/lib/contact-import/copy"
import { cn } from "@/lib/utils"

/**
 * Step 1: choose a CSV. A dashed drop zone (a placeholder, so a real border is
 * allowed) with one button that opens the file picker; dropping a file works
 * too. The hidden input is not a tab stop: the button is the control.
 * Errors sit under the zone with role="alert" and return focus to the button.
 */
export function UploadStep({
  busy,
  error,
  onFile,
  maxMb,
  maxRows,
}: {
  busy: boolean
  error: string | null
  onFile: (file: File) => void
  maxMb: number
  maxRows: number
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  const [dragging, setDragging] = React.useState(false)

  React.useEffect(() => {
    if (error) buttonRef.current?.focus()
  }, [error])

  const pick = (files: FileList | null) => {
    const file = files?.[0]
    if (file) onFile(file)
    if (inputRef.current) inputRef.current.value = ""
  }

  return (
    <section aria-labelledby="upload-title" className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!busy) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (!busy) pick(e.dataTransfer.files)
        }}
        aria-busy={busy}
        className={cn(
          "flex flex-col items-center gap-3 rounded-xl border border-dashed border-neutral-300 bg-surface px-4 py-10 text-center dark:border-neutral-700",
          dragging && "border-fg-strong",
          error && "border-danger"
        )}
      >
        <UploadCloud className="size-5 text-fg-muted" />
        <div className="flex max-w-md flex-col gap-1">
          <h2 id="upload-title" className="text-section text-fg-strong">
            {COPY.uploadTitle}
          </h2>
          <p id="upload-hint" className="text-body text-fg-muted">
            {COPY.uploadHint(maxMb, maxRows)}
          </p>
          <p className="text-body text-fg-muted">{COPY.uploadRequired}</p>
        </div>
        <Button
          ref={buttonRef}
          onClick={() => inputRef.current?.click()}
          loading={busy}
          aria-describedby={error ? "upload-hint upload-error" : "upload-hint"}
        >
          {busy ? COPY.readingFile : error ? COPY.chooseAnother : COPY.chooseFile}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
          onChange={(e) => pick(e.target.files)}
        />
      </div>
      {error && (
        <p id="upload-error" role="alert" className="flex items-start gap-1.5 text-body text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </section>
  )
}

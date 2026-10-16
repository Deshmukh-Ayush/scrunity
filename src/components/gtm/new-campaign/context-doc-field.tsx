"use client"

import * as React from "react"
import { UploadCloud, X } from "@/components/ui/icons"
import { Button } from "@/components/ui/button"
import { FieldError } from "@/components/ui/field"
import { cn } from "@/lib/utils"
import { OptionalMark } from "./optional-mark"

const ACCEPTED = [".md", ".txt"]

/**
 * Optional supporting document as a dashed dropzone. The real file input is
 * visually hidden; "Choose file" is a real button, so it works by keyboard.
 * Dropping a file does the same. Only .md and .txt are read (as text).
 */
export function ContextDocField({
  fileName,
  characters,
  onLoad,
  onClear,
}: {
  fileName: string
  characters: number
  onLoad: (fileName: string, text: string) => void
  onClear: () => void
}) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [dragging, setDragging] = React.useState(false)
  const labelId = React.useId()

  const read = (file: File | undefined) => {
    if (!file) return
    if (!ACCEPTED.some((ext) => file.name.toLowerCase().endsWith(ext))) {
      setError("Choose a .md or .txt file.")
      return
    }
    setError(null)
    const reader = new FileReader()
    reader.onload = () => onLoad(file.name, typeof reader.result === "string" ? reader.result : "")
    reader.readAsText(file)
  }

  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-2">
      <span id={labelId} className="text-sm font-medium text-neutral-800">
        Supporting document <OptionalMark />
      </span>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          read(e.dataTransfer.files?.[0])
        }}
        data-dragging={dragging || undefined}
        className={cn(
          "flex flex-col items-center gap-3 rounded-lg border border-dashed border-border-strong px-4 py-6 text-center",
          "transition-[background-color,border-color] duration-(--motion-fast) ease-out motion-reduce:transition-none",
          "data-[dragging]:border-fg-muted data-[dragging]:bg-muted"
        )}
      >
        {fileName ? (
          <div className="flex w-full min-w-0 items-center justify-between gap-3 text-start">
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-body font-medium text-fg-strong" title={fileName}>
                {fileName}
              </span>
              <span className="text-meta text-fg-muted tabular-nums">
                {new Intl.NumberFormat("en").format(characters)} characters added to the research
              </span>
            </span>
            <Button type="button" size="sm" variant="ghost" onClick={onClear}>
              <X data-icon="inline-start" />
              Remove
            </Button>
          </div>
        ) : (
          <>
            <UploadCloud className="size-5 text-fg-muted" />
            <div className="flex flex-col gap-0.5">
              <p className="text-body text-fg-default">Drop a .md or .txt file here</p>
              <p className="text-meta text-fg-muted">Product notes or a battlecard. Leave out personal information.</p>
            </div>
            <Button type="button" size="sm" onClick={() => inputRef.current?.click()}>
              Choose file
            </Button>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          tabIndex={-1}
          aria-hidden="true"
          className="sr-only"
          onChange={(e) => {
            read(e.target.files?.[0])
            e.target.value = ""
          }}
        />
      </div>
      <FieldError>{error}</FieldError>
    </div>
  )
}

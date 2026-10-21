import type * as React from "react"
import { IMPORT_COPY as COPY } from "@/lib/contact-import/copy"
import { cn } from "@/lib/utils"

export type ImportStepId = "upload" | "map" | "review" | "done"

const STEPS: Array<{ id: ImportStepId; label: string }> = [
  { id: "upload", label: COPY.stepUpload },
  { id: "map", label: COPY.stepMap },
  { id: "review", label: COPY.stepReview },
  { id: "done", label: COPY.stepDone },
]

/**
 * Where the user is in the import: an ordered list with the current step
 * marked by aria-current and weight (not color alone), plus "Step N of 4".
 * The current step's name is a focusable heading, so moving between steps
 * moves focus to it.
 */
export function ImportSteps({ current, headingRef }: { current: ImportStepId; headingRef?: React.Ref<HTMLHeadingElement> }) {
  const index = STEPS.findIndex((s) => s.id === current)
  return (
    <div className="flex flex-col gap-2">
      <ol aria-label="Import steps" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-meta">
        {STEPS.map((s, i) => (
          <li key={s.id} aria-current={i === index ? "step" : undefined} className="flex items-center gap-2">
            <span className={cn("tabular-nums", i === index ? "font-semibold text-fg-strong" : i < index ? "text-fg-default" : "text-fg-muted")}>
              {i + 1}. {s.label}
            </span>
            {i < STEPS.length - 1 && <span aria-hidden="true" className="text-fg-subtle">/</span>}
          </li>
        ))}
      </ol>
      <h2 ref={headingRef} tabIndex={-1} className="sr-only">
        Step {index + 1} of {STEPS.length}: {STEPS[index].label}
      </h2>
    </div>
  )
}

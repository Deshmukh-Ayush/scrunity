"use client"

import { cn } from "@/lib/utils"
import { COMPANY_PROFILE_COPY as COPY } from "@/lib/company-profile/copy"
import type { ResearchFormMode } from "@/lib/company-profile/input"

const OPTIONS: Array<{ value: ResearchFormMode; label: string; description: string }> = [
  { value: "use_saved", label: COPY.modeUseSaved, description: COPY.modeUseSavedText },
  { value: "ask_every_time", label: COPY.modeAsk, description: COPY.modeAskText },
]

/**
 * How new research runs use the saved details: two native radios as cards
 * (arrow keys move between them). Checked is a strong border plus weight,
 * never brand, like the campaign source choice.
 */
export function ResearchModeChoice({
  value,
  onChange,
}: {
  value: ResearchFormMode
  onChange: (value: ResearchFormMode) => void
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-4 text-section text-fg-strong">{COPY.modeLegend}</legend>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {OPTIONS.map((option) => {
          const checked = option.value === value
          const id = `research-mode-${option.value}`
          return (
            <label
              key={option.value}
              htmlFor={id}
              className={cn(
                "flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-surface p-3",
                checked && "border-fg-strong bg-canvas"
              )}
            >
              <input
                id={id}
                type="radio"
                name="research-form-mode"
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                aria-describedby={`${id}-text`}
                className="mt-0.5 size-4 shrink-0 accent-foreground"
              />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className={cn("text-body text-fg-strong", checked && "font-semibold")}>{option.label}</span>
                <span id={`${id}-text`} className="text-body text-fg-muted">
                  {option.description}
                </span>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

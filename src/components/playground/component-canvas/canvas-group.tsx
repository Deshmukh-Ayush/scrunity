import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** One titled, dashed-border group. Slots share each row equally and wrap. */
export function CanvasGroup({
  id,
  title,
  columns,
  className,
  children,
}: {
  id: string
  title: string
  columns: number
  className?: string
  children: ReactNode
}) {
  return (
    <section id={`group-${id}`} aria-labelledby={`group-${id}-title`} className={cn("min-w-0", className)}>
      <h2 id={`group-${id}-title`} className="mb-2 text-sm font-normal text-muted-foreground">
        {title}
      </h2>
      <div
        className="grid gap-x-12 gap-y-10 rounded-xl border border-dashed border-muted-foreground/25 p-10"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {children}
      </div>
    </section>
  )
}

/**
 * One example slot. `data-canvas-preview` keeps native pointer, wheel and touch
 * gestures inside it; `overflow-auto` makes it its own scroll container so the
 * canvas's `touch-action: none` does not reach the preview.
 */
export function CanvasSlot({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div data-canvas-preview className="flex min-w-0 flex-col items-start gap-3 overflow-auto p-2 cursor-auto select-text">
      {children}
      {label && <span className="font-mono text-[11px] text-muted-foreground">{label}</span>}
    </div>
  )
}

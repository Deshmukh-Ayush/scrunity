import { Children, type ReactNode } from "react"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * One treatment for every variant: a tint fill, no ring, 20px tall, text-meta.
 * Neutral by default; status variants (success, warning, danger) use the tint
 * + text token pairs and must carry a text label (and ideally an icon): never
 * signal status with color alone. No animation.
 *
 * Optical alignment (better-ui): a leading icon gets 4px padding against the
 * text side's 6px, every icon renders at 14px, and icons shift vertically by
 * --badge-icon-offset (globals.css; tune it by hand). Outline icons use a
 * 1.5px stroke; the solid status icons (components/icons/status) have none.
 *
 * Long labels never overflow: the badge stops at its container's width
 * (max-w-full), the label truncates and the full text is in the title.
 */
const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit max-w-full min-w-0 shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm px-1.5 text-meta whitespace-nowrap tabular-nums [--icon-stroke:1.5px] has-[>svg:first-child]:ps-1 has-data-[icon=inline-start]:ps-1 has-data-[icon=inline-end]:pe-1 [&>svg]:pointer-events-none [&>svg]:size-3.5! [&>svg]:shrink-0 [&>svg]:translate-y-(--badge-icon-offset)",
  {
    variants: {
      variant: {
        neutral: "bg-muted text-fg-default",
        success: "bg-success-tint text-success",
        warning: "bg-warning-tint text-warning",
        danger: "bg-danger-tint text-danger",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
)

/** Groups adjacent text children into one truncating label; elements (icons) pass through. */
function withTruncatingLabel(children: ReactNode): { content: ReactNode[]; text: string } {
  const content: ReactNode[] = []
  let run: string[] = []
  let text = ""
  const flush = () => {
    if (run.length === 0) return
    const label = run.join("")
    text += label
    content.push(
      <span key={`label-${content.length}`} data-slot="badge-label" className="min-w-0 truncate">
        {label}
      </span>
    )
    run = []
  }
  // toArray drops null/boolean children and gives elements stable keys.
  for (const child of Children.toArray(children)) {
    if (typeof child === "string" || typeof child === "number") run.push(String(child))
    else {
      flush()
      content.push(child)
    }
  }
  flush()
  return { content, text: text.trim() }
}

function Badge({
  className,
  variant = "neutral",
  render,
  children,
  title,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  const { content, text } = withTruncatingLabel(children)
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
        title: title ?? (text || undefined),
        children: content,
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }

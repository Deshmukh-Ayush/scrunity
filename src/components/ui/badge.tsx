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
 * text side's 6px, every icon renders at 14px with a 2px stroke (medium text),
 * and icons sit 0.5px low to meet the label's visual center.
 */
const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm px-1.5 text-meta whitespace-nowrap tabular-nums [--icon-stroke:2px] has-[>svg:first-child]:ps-1 has-data-[icon=inline-start]:ps-1 has-data-[icon=inline-end]:pe-1 [&>svg]:pointer-events-none [&>svg]:size-3.5! [&>svg]:shrink-0 [&>svg]:translate-y-[0.5px]",
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

function Badge({
  className,
  variant = "neutral",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
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

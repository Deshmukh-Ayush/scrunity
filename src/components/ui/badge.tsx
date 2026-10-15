import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * Neutral by default. Status variants (success, warning, danger) use the
 * tint + text token pairs and must carry a text label (and ideally an icon):
 * never signal status with color alone. No animation.
 */
const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm px-1.5 text-meta whitespace-nowrap tabular-nums has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 [&>svg]:pointer-events-none [&>svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        neutral: "bg-muted text-fg-default",
        outline: "text-fg-default shadow-surface",
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

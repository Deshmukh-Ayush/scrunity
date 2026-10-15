import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"

/**
 * Appearance (variant) is separate from size. `secondary` is the default;
 * `brand` is for the one action per view that genuinely needs attention.
 * Hover, pressed and focus use the ui-* variants from globals.css so the
 * testing route can force them with data-force.
 */
const buttonVariants = cva(
  [
    "group/button relative inline-flex shrink-0 items-center justify-center rounded-md font-medium whitespace-nowrap outline-none select-none",
    "transition-[scale,background-color,box-shadow,color,filter] duration-200 ease-out",
    "motion-safe:ui-pressed:scale-[0.97]",
    "ui-focus:ring-2 ui-focus:ring-ring ui-focus:ring-offset-2 ui-focus:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50 data-[loading]:pointer-events-none",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        secondary:
          "bg-surface text-fg-default shadow-raised ui-hover:bg-muted aria-expanded:bg-muted",
        outline:
          "bg-transparent text-fg-default shadow-raised ui-hover:bg-muted aria-expanded:bg-muted",
        ghost: "text-fg-default ui-hover:bg-muted aria-expanded:bg-muted",
        brand: [
          "text-brand-foreground",
          "bg-[linear-gradient(to_bottom,var(--brand-top),var(--brand-bottom))]",
          // inner top highlight, darker brand edge, small lift
          "shadow-[inset_0_1px_0_0_rgb(255_255_255/0.28),0_0_0_1px_var(--brand-edge),0_1px_2px_0_rgb(0_0_0/0.14)]",
          "ui-hover:brightness-[1.04]",
          "ui-pressed:shadow-[inset_0_1px_0_0_rgb(255_255_255/0),0_0_0_1px_var(--brand-edge),0_1px_1px_0_rgb(0_0_0/0.10)]",
        ],
        danger: [
          "bg-danger text-white",
          "shadow-[0_0_0_1px_color-mix(in_srgb,var(--danger)_80%,black),0_1px_2px_0_rgb(0_0_0/0.14)]",
          "ui-hover:brightness-110",
        ],
      },
      size: {
        sm: "h-7 gap-1.5 px-2.5 text-body has-data-[icon=inline-start]:pl-2 has-data-[icon=inline-end]:pr-2 [&_svg:not([class*='size-'])]:size-3.5",
        md: "h-8 gap-1.5 px-3 text-body has-data-[icon=inline-start]:pl-2.5 has-data-[icon=inline-end]:pr-2.5 [&_svg:not([class*='size-'])]:size-4",
        lg: "h-9 gap-2 px-3.5 text-body has-data-[icon=inline-start]:pl-3 has-data-[icon=inline-end]:pr-3 [&_svg:not([class*='size-'])]:size-4",
        "icon-sm": "size-7 [&_svg:not([class*='size-'])]:size-3.5",
        icon: "size-8 [&_svg:not([class*='size-'])]:size-4",
        "icon-lg": "size-9 [&_svg:not([class*='size-'])]:size-5",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
    },
  }
)

type ButtonProps = ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    /** Shows a spinner and blocks clicks; keeps the button's width and color. */
    loading?: boolean
  }

function Button({
  className,
  variant = "secondary",
  size = "md",
  loading = false,
  children,
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      data-variant={variant}
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {loading ? (
        <>
          {/* Keeps the label in the layout so the width does not change. */}
          <span className="invisible inline-flex items-center gap-[inherit]">{children}</span>
          <span className="absolute inset-0 flex items-center justify-center">
            <HugeiconsIcon
              icon={Loading03Icon}
              aria-hidden="true"
              className="size-4 motion-safe:animate-spin"
            />
          </span>
        </>
      ) : (
        children
      )}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants, type ButtonProps }

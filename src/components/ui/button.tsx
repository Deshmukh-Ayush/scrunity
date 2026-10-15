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
 *
 * Optical alignment (better-ui): mark a leading or trailing icon with
 * data-icon="inline-start|inline-end"; that side gets 2px less padding.
 * Icons next to the label sit 0.5px lower, because a sentence-case Inter label
 * reads below the line box's center (its x-height center is ~1px low).
 */
const buttonVariants = cva(
  [
    "group/button relative inline-flex shrink-0 items-center justify-center rounded-md border border-transparent font-medium whitespace-nowrap outline-none select-none [-webkit-tap-highlight-color:transparent]",
    "transition-[scale,background-color,box-shadow,color,filter] duration-150 ease-out",
    "ui-focus:focus-ring",
    "disabled:pointer-events-none disabled:opacity-50 data-[loading]:pointer-events-none",
    "[--icon-stroke:2px] [&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        secondary: "bg-surface text-fg-default shadow-raised ui-hover:bg-muted aria-expanded:bg-muted",
        outline: "bg-transparent text-fg-default shadow-raised ui-hover:bg-muted aria-expanded:bg-muted",
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
        sm: "h-7 gap-1.5 px-2.5 text-body has-data-[icon=inline-start]:ps-2 has-data-[icon=inline-end]:pe-2 [&_svg]:translate-y-[0.5px] [&_svg:not([class*='size-'])]:size-3.5",
        md: "h-8 gap-1.5 px-3 text-body has-data-[icon=inline-start]:ps-2.5 has-data-[icon=inline-end]:pe-2.5 [&_svg]:translate-y-[0.5px] [&_svg:not([class*='size-'])]:size-4",
        lg: "h-9 gap-2 px-3.5 text-body has-data-[icon=inline-start]:ps-3 has-data-[icon=inline-end]:pe-3 [&_svg]:translate-y-[0.5px] [&_svg:not([class*='size-'])]:size-4",
        "icon-sm": "size-7 [&_svg:not([class*='size-'])]:size-3.5",
        icon: "size-8 [&_svg:not([class*='size-'])]:size-4",
        "icon-lg": "size-9 [&_svg:not([class*='size-'])]:size-5",
      },
      /** better-ui press feedback: 0.96 over 150ms ease-out, never while disabled, only without reduced motion. */
      press: {
        scale: "motion-safe:not-disabled:ui-pressed:scale-[0.96]",
        none: "",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
      press: "scale",
    },
  }
)

type ButtonProps = ButtonPrimitive.Props &
  Omit<VariantProps<typeof buttonVariants>, "press"> & {
    /** Shows a spinner and blocks clicks; keeps the button's width and color. */
    loading?: boolean
    /** Opt out of the press scale where the motion would distract. */
    static?: boolean
  }

function Button({
  className,
  variant = "secondary",
  size = "md",
  loading = false,
  static: isStatic = false,
  children,
  ...props
}: ButtonProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      data-variant={variant}
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size, press: isStatic ? "none" : "scale", className }))}
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
              className="ui-icon size-4 translate-y-0! motion-safe:animate-spin"
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

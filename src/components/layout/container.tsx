import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

/**
 * Centered layout wrapper with responsive side padding (16px, 24px at sm,
 * 32px at lg). It has no background: the app shell owns the background, so a
 * Container can sit on the canvas or on a white panel.
 *
 * - prose: max 720px, for chat and the agent composer
 * - page (default): max-w-7xl, for settings and forms
 * - full: no max width, for CRM tables that use the whole width
 */
const containerVariants = cva("mx-auto w-full px-4 sm:px-6 lg:px-8", {
  variants: {
    width: {
      prose: "max-w-[720px]",
      page: "max-w-7xl",
      full: "max-w-none",
    },
  },
  defaultVariants: {
    width: "page",
  },
})

function Container({
  className,
  width = "page",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof containerVariants>) {
  return (
    <div
      data-slot="container"
      data-width={width}
      className={cn(containerVariants({ width }), className)}
      {...props}
    />
  )
}

export { Container, containerVariants }

import type { VariantProps } from "class-variance-authority"
import { Button, type buttonVariants } from "@/components/ui/button"
import { CanvasGroup, CanvasSlot } from "./canvas-group"

type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>

export const BUTTON_VARIANTS = [
  "default",
  "tertiary",
  "outline",
  "secondary",
  "ghost",
  "destructive",
  "link",
] as const satisfies readonly ButtonVariant[]

// Coverage: stops compiling when button.tsx gains a variant that isn't listed above.
type MissingButtonVariant = Exclude<ButtonVariant, (typeof BUTTON_VARIANTS)[number]>
export const buttonVariantCoverage: [MissingButtonVariant] extends [never] ? true : MissingButtonVariant = true

/** Style comparison: only `variant` changes; text and size stay the same. */
export function ButtonExamples() {
  return (
    <CanvasGroup id="button-variants" title="Button · variant" columns={BUTTON_VARIANTS.length} className="w-full">
      {BUTTON_VARIANTS.map((variant) => (
        <CanvasSlot key={variant} label={variant}>
          <Button variant={variant}>Continue</Button>
        </CanvasSlot>
      ))}
    </CanvasGroup>
  )
}

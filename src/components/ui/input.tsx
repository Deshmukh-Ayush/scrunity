import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "@/lib/utils"

/**
 * The form-field recipe from the founder's landing page, on semantic tokens.
 * Shared by Input, Textarea and SelectTrigger. `text-base md:text-sm` keeps
 * 16px on phones so iOS does not zoom into the field.
 * Focus is the shared focus-ring (globals.css: border-ring + 3px ring-ring/50,
 * --ring = --brand) via ui-focus, so the testing route can force it with
 * data-force. It eases in over 150ms; no transition under reduced motion.
 */
const fieldControlClassName =
  "w-full min-w-0 rounded-md border border-input bg-transparent px-2.5 py-1 text-base text-fg-strong transition-[color,background-color,border-color,box-shadow] duration-150 ease-out outline-none motion-reduce:transition-none placeholder:text-fg-subtle ui-focus:focus-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50 aria-invalid:border-danger aria-invalid:ring-3 aria-invalid:ring-danger/20 md:text-sm"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        fieldControlClassName,
        "h-8 file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-fg-strong",
        className
      )}
      {...props}
    />
  )
}

export { Input, fieldControlClassName }

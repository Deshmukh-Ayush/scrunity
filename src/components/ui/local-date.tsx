"use client"

import { useHydrated } from "@/hooks/use-hydrated"

type LocalDateProps = Omit<
  React.ComponentProps<"time">,
  "children" | "dateTime"
> & {
  value: string | Date
  /** "date" uses toLocaleDateString, "time" uses toLocaleTimeString. */
  kind?: "date" | "time"
  options?: Intl.DateTimeFormatOptions
  /** Locale used after hydration; defaults to the viewer's. */
  locale?: string
}

/**
 * A date or time in the viewer's timezone. Until hydration it renders a fixed
 * en-US/UTC form, so server and client markup match, then switches to the
 * viewer's local time.
 */
export function LocalDate({
  value,
  kind = "date",
  options,
  locale,
  ...props
}: LocalDateProps) {
  const hydrated = useHydrated()
  const date = typeof value === "string" ? new Date(value) : value

  const format = (
    loc: string | undefined,
    opts?: Intl.DateTimeFormatOptions
  ) =>
    kind === "time"
      ? date.toLocaleTimeString(loc, opts)
      : date.toLocaleDateString(loc, opts)

  const text = hydrated
    ? format(locale, options)
    : format("en-US", { ...options, timeZone: "UTC" })

  return (
    <time dateTime={date.toISOString()} {...props}>
      {text}
    </time>
  )
}

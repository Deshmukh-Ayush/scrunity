"use client"

import { useState } from "react"
import { format } from "date-fns"
import { useHydrated } from "@/hooks/use-hydrated"

const UTC_SHORT_DATE: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
}

const UTC_FULL_DATE: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
}

/**
 * Compact inbox timestamp: time today, weekday this week, otherwise "MMM d".
 * Relative to the viewer's clock, so it shows a fixed UTC date until hydration.
 */
export function ThreadTimestamp({ value }: { value: string }) {
  const hydrated = useHydrated()
  // Captured once per mount; only read after hydration, when it is the viewer's clock.
  const [now] = useState(() => Date.now())
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return <>{value}</>

  let text: string
  if (!hydrated) {
    text = d.toLocaleDateString("en-US", UTC_SHORT_DATE)
  } else {
    const diffDays = (now - d.getTime()) / (1000 * 60 * 60 * 24)
    text =
      diffDays < 1
        ? format(d, "h:mm a")
        : diffDays < 7
          ? format(d, "EEE")
          : format(d, "MMM d")
  }

  return <time dateTime={d.toISOString()}>{text}</time>
}

/** Full message timestamp in the viewer's timezone (UTC until hydration). */
export function MessageTimestamp({ value }: { value: string }) {
  const hydrated = useHydrated()
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return <>{value}</>

  const text = hydrated
    ? format(d, "MMM d, yyyy 'at' h:mm a")
    : d.toLocaleString("en-US", UTC_FULL_DATE)

  return <time dateTime={d.toISOString()}>{text}</time>
}

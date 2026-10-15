"use client"

import * as React from "react"

/**
 * A boolean remembered in localStorage under `key`. The first render always
 * uses `defaultValue` (server and hydration match); the stored value is read
 * after mount. Every storage access is wrapped, so private windows and
 * blocked storage just fall back to the default.
 */
export function useStoredBoolean(key: string, defaultValue: boolean) {
  const [value, setValue] = React.useState(defaultValue)

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key)
      if (stored === "true" || stored === "false") setValue(stored === "true")
    } catch {}
  }, [key])

  const update = React.useCallback(
    (next: boolean) => {
      setValue(next)
      try {
        window.localStorage.setItem(key, String(next))
      } catch {}
    },
    [key]
  )

  return [value, update] as const
}

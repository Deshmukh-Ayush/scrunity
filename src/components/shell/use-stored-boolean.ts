"use client"

import * as React from "react"

const CHANGE_EVENT = "scrunity:stored-boolean"

// Fallback for blocked storage: the value still toggles for this page view.
const memory = new Map<string, boolean>()

function read(key: string): boolean | null {
  try {
    const stored = window.localStorage.getItem(key)
    if (stored === "true" || stored === "false") return stored === "true"
  } catch {}
  return memory.get(key) ?? null
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange)
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener("storage", onChange)
    window.removeEventListener(CHANGE_EVENT, onChange)
  }
}

/**
 * A boolean remembered in localStorage under `key`. The server render and
 * hydration use `defaultValue` (so markup matches); the stored value takes
 * over right after. Every storage access is wrapped, so private windows and
 * blocked storage fall back to the default. Instances with the same key (the
 * desktop sidebar and the mobile drawer) stay in sync.
 */
export function useStoredBoolean(key: string, defaultValue: boolean) {
  const stored = React.useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null
  )
  const value = stored ?? defaultValue

  const update = React.useCallback(
    (next: boolean) => {
      memory.set(key, next)
      try {
        window.localStorage.setItem(key, String(next))
      } catch {}
      window.dispatchEvent(new Event(CHANGE_EVENT))
    },
    [key]
  )

  return [value, update] as const
}

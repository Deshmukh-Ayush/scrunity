"use client"

import { useCallback, useEffect, useState } from "react"
import type { ShowcaseEntry } from "../registry/types"

/**
 * The selected showcase entry, kept in the URL hash (#button) so a component
 * can be linked. The first render always uses the first entry, so server and
 * hydration markup match; the hash takes over right after.
 */
export function useShowcaseSelection(entries: ShowcaseEntry[]) {
  const [selectedId, setSelectedId] = useState(entries[0].id)

  useEffect(() => {
    const fromHash = () => {
      const id = window.location.hash.slice(1)
      if (entries.some((e) => e.id === id)) setSelectedId(id)
    }
    fromHash()
    window.addEventListener("hashchange", fromHash)
    return () => window.removeEventListener("hashchange", fromHash)
  }, [entries])

  const select = useCallback((id: string) => {
    setSelectedId(id)
    window.history.replaceState(null, "", `#${id}`)
  }, [])

  const entry = entries.find((e) => e.id === selectedId) ?? entries[0]
  return [entry, select] as const
}

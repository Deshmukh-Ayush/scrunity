import { useSyncExternalStore } from "react"

const subscribe = () => () => {}

/**
 * False during the server render and the hydration pass, true afterwards.
 *
 * Server-rendered client components must produce the same markup on the server
 * and during hydration, so anything that depends on the browser's clock, locale
 * or timezone (relative times, toLocaleDateString, staleness checks) should wait
 * for this to be true.
 */
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )
}

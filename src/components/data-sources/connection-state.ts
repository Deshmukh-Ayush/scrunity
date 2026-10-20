import type { PublicConnection } from "@/lib/data-sources/types"

/**
 * The Data sources card's five states, derived from the stored connection and
 * what the page is doing right now. Pure, so the testing route renders every
 * state from fixtures.
 * - not_connected: no connection, or it was disconnected.
 * - connecting: a pasted key is being checked with Apollo.
 * - connected: the key works.
 * - needs_reconnect: Apollo rejected the saved key; campaigns can't search.
 * - error: the key works but the last check or run hit a problem the customer
 *   fixes in Apollo (plan without API search, credits used up, rate limit).
 */
export type ConnectionViewState = "not_connected" | "connecting" | "connected" | "needs_reconnect" | "error"

export function connectionViewState(connection: PublicConnection | null, connecting: boolean): ConnectionViewState {
  if (connecting) return "connecting"
  if (!connection || connection.status === "revoked") return "not_connected"
  if (connection.status === "invalid") return "needs_reconnect"
  return connection.lastErrorCode ? "error" : "connected"
}

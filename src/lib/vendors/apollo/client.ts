import { APOLLO_BASE_URL } from "./constants"
import { ApolloError, apolloFailureFor } from "./errors"
import type { ConnectionLimiter } from "./limiter"

/**
 * The one HTTP path to Apollo for customer-connected accounts. The key is
 * passed in by the caller (decrypted from the customer's connection inside the
 * step that needs it); this module never reads process.env and never logs,
 * stores or rethrows the key or Apollo's response text.
 *
 * 429 is retried with backoff (Retry-After when given) inside a time budget
 * that keeps one call well under a minute, so it fits one Inngest step; the
 * connection's own limiter is paused for the wait.
 */

const REQUEST_TIMEOUT_MS = 20_000
const TOTAL_BUDGET_MS = 45_000
const DEFAULT_MAX_RETRIES = 2
const BASE_BACKOFF_MS = 5_000
const MAX_BACKOFF_MS = 20_000

export interface ApolloClientDeps {
  apiKey: string
  /** The connection's limiter (lib/vendors/apollo/limiter.ts). */
  limiter: ConnectionLimiter
  /** Replaced by fixture mode and tests; never a real network call there. */
  fetch?: (url: string, init: RequestInit) => Promise<Response>
  sleep?: (ms: number) => Promise<void>
  maxRetries?: number
  timeoutMs?: number
  totalBudgetMs?: number
  now?: () => number
}

export interface ApolloRequest {
  path: string
  /** Array filters go in the query string, as Apollo documents them. */
  query?: URLSearchParams
  /** JSON body (bulk_match). */
  body?: unknown
}

function retryDelayMs(response: Response, attempt: number): number {
  const seconds = Number(response.headers.get("retry-after"))
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, MAX_BACKOFF_MS)
  return Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS)
}

/** Apollo's error text, read only to tell a plan block from a bad key. */
async function errorText(response: Response): Promise<string> {
  const text = await response.text().catch(() => "")
  return text.slice(0, 500)
}

/** POSTs one request and returns the parsed JSON body (unknown: callers narrow it). */
export async function apolloRequest(request: ApolloRequest, deps: ApolloClientDeps): Promise<unknown> {
  if (!deps.apiKey) throw new ApolloError("apollo_key_invalid", null)
  const doFetch = deps.fetch ?? ((url: string, init: RequestInit) => fetch(url, init))
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const maxRetries = deps.maxRetries ?? DEFAULT_MAX_RETRIES
  const timeoutMs = deps.timeoutMs ?? REQUEST_TIMEOUT_MS
  const now = deps.now ?? Date.now
  const deadline = now() + (deps.totalBudgetMs ?? TOTAL_BUDGET_MS)
  const query = request.query?.toString()
  const url = `${APOLLO_BASE_URL}${request.path}${query ? `?${query}` : ""}`

  for (let attempt = 0; ; attempt++) {
    let response: Response
    try {
      response = await deps.limiter.run(() =>
        doFetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            "x-api-key": deps.apiKey,
          },
          body: request.body === undefined ? undefined : JSON.stringify(request.body),
          signal: AbortSignal.timeout(timeoutMs),
        })
      )
    } catch {
      // Timed out or dropped after sending: Apollo may have run (and billed) it.
      throw new ApolloError("apollo_request_failed", null, "unknown")
    }

    if (response.status === 429 && attempt < maxRetries) {
      const waitMs = retryDelayMs(response, attempt)
      deps.limiter.pause(waitMs)
      if (now() + waitMs + timeoutMs <= deadline) {
        await sleep(waitMs)
        continue
      }
    }
    if (!response.ok) {
      throw new ApolloError(apolloFailureFor(response.status, await errorText(response)), response.status)
    }
    try {
      return await response.json()
    } catch {
      throw new ApolloError("apollo_request_failed", response.status, "unknown")
    }
  }
}

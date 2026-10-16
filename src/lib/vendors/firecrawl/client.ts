import { z } from "zod"
import { getFirecrawlLimiter } from "@/lib/firecrawl-limiter"
import { FirecrawlDataError, failureForCode, failureForStatus, TERMS_REQUIRED_CODE } from "./errors"

/**
 * Typed client for Firecrawl's data calls (Alexandria): POST /v2/scrape with
 * `{ alexandria: { provider, capability, options } }`, or an array of up to 10
 * such calls in one request (each its own upstream job, billed separately).
 *
 * The API key is read here and only here (getFirecrawlApiKey) for data calls,
 * and is never logged. Every response is narrowed from `unknown` with zod.
 *
 * Response envelope: the OpenAPI contract describes one call as
 * `{ success, provider, capability, creditsCost, data }`; the Alexandria guide
 * says SDK results are read from `result.alexandria[i].data` and that raw HTTP
 * wraps the SDK result in `data`. Both shapes are accepted.
 */

export const FIRECRAWL_SCRAPE_URL = "https://api.firecrawl.dev/v2/scrape"
export const MAX_CALLS_PER_REQUEST = 10
/**
 * One request may wait while its upstream jobs run (direct FullEnrich jobs took
 * 30-90 s), so the timeout is generous; the overall budget keeps a whole call,
 * retries included, well inside one 300 s Inngest step.
 */
const REQUEST_TIMEOUT_MS = 120_000
const TOTAL_BUDGET_MS = 180_000
const DEFAULT_MAX_RETRIES = 3
const BASE_BACKOFF_MS = 5_000
const MAX_BACKOFF_MS = 60_000

export function getFirecrawlApiKey(): string | null {
  return process.env.FIRECRAWL_API_KEY?.trim() || null
}

export function hasFirecrawlApiKey(): boolean {
  return getFirecrawlApiKey() !== null
}

export interface AlexandriaCall {
  provider: "fullenrich"
  capability: string
  options: Record<string, unknown>
}

export type AlexandriaResult =
  | { ok: true; capability: string; creditsCost: number; data: unknown }
  | { ok: false; error: FirecrawlDataError }

export interface FirecrawlClientDeps {
  /** Replaced by fixture mode and tests; never a real network call there. */
  fetch?: (url: string, init: RequestInit) => Promise<Response>
  sleep?: (ms: number) => Promise<void>
  /** Runs one HTTP request; default is the process-wide Firecrawl limiter. */
  schedule?: <T>(request: () => Promise<T>) => Promise<T>
  /** Called with the wait before each rate-limit retry; default pauses the limiter. */
  onRateLimited?: (waitMs: number) => void
  apiKey?: string | null
  maxRetries?: number
  timeoutMs?: number
  /** Longest a call may take including retries and their waits. */
  totalBudgetMs?: number
  now?: () => number
}

const errorBodySchema = z.looseObject({
  success: z.boolean().nullish(),
  code: z.string().nullish(),
  error: z.union([z.string(), z.looseObject({ code: z.string().nullish(), message: z.string().nullish() })]).nullish(),
  message: z.string().nullish(),
  requiresAction: z.looseObject({ url: z.string().nullish() }).nullish(),
})

const callResultSchema = errorBodySchema.extend({
  provider: z.string().nullish(),
  capability: z.string().nullish(),
  creditsCost: z.number().int().nonnegative().nullish(),
  data: z.unknown().optional(),
})

type ErrorBody = z.infer<typeof errorBodySchema>

function errorCode(body: ErrorBody): string | null {
  if (body.code) return body.code
  if (typeof body.error === "string") return body.error
  return body.error?.code ?? null
}

function errorMessage(body: ErrorBody): string {
  const fromError = typeof body.error === "string" ? body.error : body.error?.message
  return (body.message ?? fromError ?? "no detail").slice(0, 200)
}

function toError(body: ErrorBody, status: number, charged: "none" | "unknown" = "none") {
  const code = errorCode(body)
  return new FirecrawlDataError(
    failureForCode(code, status),
    code === TERMS_REQUIRED_CODE ? "provider terms not accepted" : `${code ?? `HTTP ${status}`}: ${errorMessage(body)}`,
    body.requiresAction?.url ?? null,
    charged
  )
}

/** The per-call results inside a 2xx body, whichever envelope Firecrawl used. */
function resultList(body: unknown): unknown[] | null {
  const top = z.looseObject({ alexandria: z.array(z.unknown()).optional(), data: z.unknown().optional() }).safeParse(body)
  if (!top.success) return null
  if (top.data.alexandria) return top.data.alexandria
  const inner = z.looseObject({ alexandria: z.array(z.unknown()).optional() }).safeParse(top.data.data)
  if (inner.success && inner.data.alexandria) return inner.data.alexandria
  // A single call answered with the OpenAPI shape.
  const single = callResultSchema.safeParse(body)
  if (single.success && single.data.creditsCost != null) return [body]
  return null
}

/**
 * Narrows a 2xx body into one result per call, in request order. A call that
 * failed (terms, rate limit, ...) becomes an `ok: false` result; a body that
 * cannot be read at all throws, marked as possibly charged.
 */
export function parseAlexandriaResponse(body: unknown, callCount: number): AlexandriaResult[] {
  const top = errorBodySchema.safeParse(body)
  if (top.success && top.data.success === false) throw toError(top.data, 200)
  const list = resultList(body)
  if (!list || list.length !== callCount) {
    throw new FirecrawlDataError("provider_request_failed", "unreadable response", null, "unknown")
  }
  return list.map((raw): AlexandriaResult => {
    const parsed = callResultSchema.safeParse(raw)
    if (!parsed.success) {
      return { ok: false, error: new FirecrawlDataError("provider_request_failed", "unreadable call result", null, "unknown") }
    }
    const item = parsed.data
    if (item.success === false || item.error || item.code) return { ok: false, error: toError(item, 200) }
    if (item.creditsCost == null) {
      return { ok: false, error: new FirecrawlDataError("provider_request_failed", "result without creditsCost", null, "unknown") }
    }
    return { ok: true, capability: item.capability ?? "", creditsCost: item.creditsCost, data: item.data ?? null }
  })
}

function retryDelayMs(response: Response, attempt: number): number {
  const seconds = Number(response.headers.get("retry-after"))
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, MAX_BACKOFF_MS)
  return Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS)
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text().catch(() => "")
  try {
    return JSON.parse(text)
  } catch {
    return { message: text.slice(0, 200) }
  }
}

/**
 * Runs 1-10 Alexandria calls in one request. HTTP 429 is retried with
 * exponential backoff (Retry-After when given) and pauses the shared limiter;
 * any other non-2xx status throws a FirecrawlDataError for the whole request.
 */
export async function runAlexandria(calls: AlexandriaCall[], deps: FirecrawlClientDeps = {}): Promise<AlexandriaResult[]> {
  if (calls.length === 0 || calls.length > MAX_CALLS_PER_REQUEST) {
    throw new Error(`runAlexandria takes 1-${MAX_CALLS_PER_REQUEST} calls, got ${calls.length}`)
  }
  const apiKey = deps.apiKey !== undefined ? deps.apiKey : getFirecrawlApiKey()
  if (!apiKey) throw new FirecrawlDataError("provider_access_denied", "FIRECRAWL_API_KEY is not set")
  const doFetch = deps.fetch ?? ((url: string, init: RequestInit) => fetch(url, init))
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const schedule = deps.schedule ?? (<T>(request: () => Promise<T>) => getFirecrawlLimiter().run(request))
  const onRateLimited = deps.onRateLimited ?? ((ms: number) => getFirecrawlLimiter().pause(ms))
  const maxRetries = deps.maxRetries ?? DEFAULT_MAX_RETRIES
  const timeoutMs = deps.timeoutMs ?? REQUEST_TIMEOUT_MS
  const now = deps.now ?? Date.now
  const deadline = now() + (deps.totalBudgetMs ?? TOTAL_BUDGET_MS)
  const body = JSON.stringify({ alexandria: calls.length === 1 ? calls[0] : calls })

  for (let attempt = 0; ; attempt++) {
    let response: Response
    try {
      response = await schedule(() =>
        doFetch(FIRECRAWL_SCRAPE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body,
          signal: AbortSignal.timeout(timeoutMs),
        })
      )
    } catch (err) {
      // Timed out or dropped after sending: Firecrawl may have run (and billed) the calls.
      const detail = err instanceof Error ? err.name : "network error"
      throw new FirecrawlDataError("provider_request_failed", `no response (${detail})`, null, "unknown")
    }
    if (response.status === 429 && attempt < maxRetries) {
      const waitMs = retryDelayMs(response, attempt)
      onRateLimited(waitMs)
      if (now() + waitMs + timeoutMs <= deadline) {
        await sleep(waitMs)
        continue
      }
    }
    const json = await readJson(response)
    if (!response.ok) {
      const parsed = errorBodySchema.safeParse(json)
      throw parsed.success
        ? toError(parsed.data, response.status)
        : new FirecrawlDataError(failureForStatus(response.status), `HTTP ${response.status}`)
    }
    return parseAlexandriaResponse(json, calls.length)
  }
}

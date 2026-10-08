import {
  extractRetryDelay,
  sleepWithStep,
  type FirecrawlRetryOptions,
} from "./firecrawl"

const ENRICH_EMAIL_FINDER_URL = "https://dev.enrich.so/api/v3/email-finder"

export interface EnrichEmailFinderResult {
  email: string
  confidence: "high" | "medium" | "low" | string
  isCatchAll: boolean
  provider?: string
  message?: string
  requestId?: string
  creditsUsed?: number
  creditsRemaining?: number
  processingTimeMs?: number
}

interface EnrichEmailFinderResponse {
  success?: boolean
  data?: {
    found?: boolean
    email?: string
    confidence?: string
    isCatchAll?: boolean
    provider?: string
    message?: string
  }
  meta?: {
    requestId?: string
    creditsUsed?: number
    creditsRemaining?: number
    processingTimeMs?: number
  }
}

export class EnrichRateLimitError extends Error {
  constructor(public readonly endpoint: string) {
    super(`enrich.so rate limit exceeded for ${endpoint} after retries.`)
    this.name = "EnrichRateLimitError"
  }
}

type EnrichTestInterceptor = (
  url: string,
  init: RequestInit
) => Promise<Response | null>
let testInterceptor: EnrichTestInterceptor | null = null

/** Test-only hook for deterministic provider responses. */
export function __setTestEnrichInterceptor(
  interceptor: EnrichTestInterceptor | null
) {
  testInterceptor = interceptor
}

async function enrichFetchWithRetry(
  payload: { firstName: string; lastName: string; domain: string },
  options?: FirecrawlRetryOptions
): Promise<Response> {
  const apiKey = process.env.ENRICH_API_KEY
  if (!apiKey) throw new Error("ENRICH_API_KEY is not configured")

  const maxRetries = options?.maxRetries ?? 3
  const stepPrefix = options?.stepPrefix || "enrich"
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 20_000)
    const init: RequestInit = {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }

    let response: Response
    try {
      response =
        (await testInterceptor?.(ENRICH_EMAIL_FINDER_URL, init)) ??
        (await fetch(ENRICH_EMAIL_FINDER_URL, init))
    } catch (error) {
      clearTimeout(timeoutId)
      if (attempt === maxRetries) throw error
      await sleepWithStep(
        1000 * 2 ** attempt,
        options?.step,
        `${stepPrefix}-network-backoff-${attempt}`
      )
      continue
    }
    clearTimeout(timeoutId)

    if (response.status !== 429) return response
    if (attempt === maxRetries)
      throw new EnrichRateLimitError(ENRICH_EMAIL_FINDER_URL)
    const { delayMs } = extractRetryDelay(
      response,
      await response.clone().text(),
      attempt,
      options
    )
    await sleepWithStep(
      delayMs,
      options?.step,
      `${stepPrefix}-429-backoff-${attempt}`
    )
  }
  throw new EnrichRateLimitError(ENRICH_EMAIL_FINDER_URL)
}

/**
 * Uses enrich.so's documented POST /api/v3/email-finder endpoint. A not-found
 * response is represented as null so callers can retain their free fallback.
 */
export async function findProfessionalEmail(
  fullName: string,
  domain: string,
  options?: FirecrawlRetryOptions
): Promise<EnrichEmailFinderResult | null> {
  const [firstName, ...rest] = fullName.trim().split(/\s+/)
  const lastName = rest.join(" ")
  if (!firstName || !lastName || !domain) return null

  const response = await enrichFetchWithRetry(
    { firstName, lastName, domain },
    options
  )
  if (!response.ok) {
    throw new Error(`enrich.so email finder returned HTTP ${response.status}`)
  }
  const body = (await response.json()) as EnrichEmailFinderResponse
  if (!body.success || !body.data?.found || !body.data.email) return null

  return {
    email: body.data.email,
    confidence: body.data.confidence || "low",
    isCatchAll: Boolean(body.data.isCatchAll),
    provider: body.data.provider,
    message: body.data.message,
    requestId: body.meta?.requestId,
    creditsUsed: body.meta?.creditsUsed,
    creditsRemaining: body.meta?.creditsRemaining,
    processingTimeMs: body.meta?.processingTimeMs,
  }
}

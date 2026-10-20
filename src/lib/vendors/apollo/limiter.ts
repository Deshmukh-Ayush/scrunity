import { FirecrawlLimiter, type FirecrawlLimiterConfig } from "@/lib/firecrawl-limiter"

/**
 * One limiter per customer connection: each customer's Apollo plan has its own
 * rate limits, so one customer's 429 must never slow another down. Reuses the
 * Firecrawl limiter's pacing (even spacing, a concurrency cap, a pause on 429);
 * only the keying differs.
 *
 * APOLLO_REQUESTS_PER_MINUTE (default 20) and APOLLO_MAX_CONCURRENCY (default
 * 1) are deliberately below Apollo's documented per-plan limits, which we
 * cannot read without an extra call.
 */

const DEFAULT_REQUESTS_PER_MINUTE = 20
const DEFAULT_MAX_CONCURRENCY = 1

function positiveIntEnv(name: string, fallback: number) {
  const parsed = parseInt(process.env[name] ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function getApolloLimiterConfig(): FirecrawlLimiterConfig {
  return {
    requestsPerMinute: positiveIntEnv("APOLLO_REQUESTS_PER_MINUTE", DEFAULT_REQUESTS_PER_MINUTE),
    maxConcurrency: positiveIntEnv("APOLLO_MAX_CONCURRENCY", DEFAULT_MAX_CONCURRENCY),
  }
}

export type ConnectionLimiter = Pick<FirecrawlLimiter, "run" | "pause">

/** Limiters keyed by connection id. A registry, so tests can use their own. */
export function createLimiterRegistry(config: () => FirecrawlLimiterConfig = getApolloLimiterConfig) {
  const limiters = new Map<string, FirecrawlLimiter>()
  return {
    get(connectionId: string): ConnectionLimiter {
      let limiter = limiters.get(connectionId)
      if (!limiter) {
        limiter = new FirecrawlLimiter(config)
        limiters.set(connectionId, limiter)
      }
      return limiter
    },
    size: () => limiters.size,
  }
}

// Kept on globalThis so every route bundle in this process shares one registry.
const globalForApollo = globalThis as unknown as {
  __apolloLimiters?: ReturnType<typeof createLimiterRegistry>
}

export function getConnectionLimiter(connectionId: string): ConnectionLimiter {
  globalForApollo.__apolloLimiters ??= createLimiterRegistry()
  return globalForApollo.__apolloLimiters.get(connectionId)
}

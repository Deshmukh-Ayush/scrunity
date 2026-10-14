/**
 * One limiter for every Firecrawl request made by this process (all research
 * runs and campaigns share it), so concurrent pipelines can't add up to more
 * than the plan allows.
 *
 * - FIRECRAWL_REQUESTS_PER_MINUTE: requests are spaced evenly at 60s / rpm.
 * - FIRECRAWL_MAX_CONCURRENCY: at most this many requests in flight at once.
 * - A 429 pushes the next allowed start back by its retry delay for everyone.
 *
 * Defaults fit Firecrawl's Free plan (10 req/min on /search and /scrape, 2
 * concurrent browsers) with headroom: 8 req/min (one every 7.5s, so any 60s
 * window holds at most 9 starts) and 2 at once. Hobby allows 100 req/min / 5.
 *
 * Only the HTTP request itself holds a slot; 429 backoff sleeps happen outside.
 */

const DEFAULT_REQUESTS_PER_MINUTE = 8
const DEFAULT_MAX_CONCURRENCY = 2

function positiveIntEnv(name: string, fallback: number) {
  const parsed = parseInt(process.env[name] ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export interface FirecrawlLimiterConfig {
  requestsPerMinute: number
  maxConcurrency: number
}

export function getFirecrawlLimiterConfig(): FirecrawlLimiterConfig {
  return {
    requestsPerMinute: positiveIntEnv("FIRECRAWL_REQUESTS_PER_MINUTE", DEFAULT_REQUESTS_PER_MINUTE),
    maxConcurrency: positiveIntEnv("FIRECRAWL_MAX_CONCURRENCY", DEFAULT_MAX_CONCURRENCY),
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export class FirecrawlLimiter {
  private active = 0
  private readonly waiting: Array<() => void> = []
  private nextStartAt = 0
  private pausedUntil = 0

  constructor(private readonly config: () => FirecrawlLimiterConfig = getFirecrawlLimiterConfig) {}

  /** Runs one Firecrawl request inside a concurrency slot and a pacing slot. */
  async run<T>(request: () => Promise<T>): Promise<T> {
    await this.acquireSlot()
    try {
      await this.waitForStartTime()
      return await request()
    } finally {
      this.releaseSlot()
    }
  }

  /** After a 429: nobody in this process starts another request for `ms`. */
  pause(ms: number) {
    const until = Date.now() + ms
    this.pausedUntil = Math.max(this.pausedUntil, until)
    this.nextStartAt = Math.max(this.nextStartAt, until)
  }

  private async acquireSlot() {
    if (this.active < this.config().maxConcurrency) {
      this.active++
      return
    }
    // The releasing caller hands its slot straight to us (active stays the same).
    await new Promise<void>((resolve) => this.waiting.push(resolve))
  }

  private releaseSlot() {
    const next = this.waiting.shift()
    if (next) next()
    else this.active--
  }

  /**
   * Reserves the next evenly spaced start time, then waits for it. If a 429
   * paused the limiter while we waited, we reserve a fresh slot behind the
   * pause, so requests queued during a pause still start one interval apart.
   */
  private async waitForStartTime() {
    const intervalMs = 60_000 / this.config().requestsPerMinute
    for (;;) {
      const now = Date.now()
      const startAt = Math.max(now, this.nextStartAt, this.pausedUntil)
      this.nextStartAt = startAt + intervalMs
      if (startAt > now) await sleep(startAt - now)
      if (Date.now() >= this.pausedUntil) return
    }
  }
}

// Kept on globalThis so every route bundle in this process shares one instance.
const globalForLimiter = globalThis as unknown as { __firecrawlLimiter?: FirecrawlLimiter }

export function getFirecrawlLimiter(): FirecrawlLimiter {
  globalForLimiter.__firecrawlLimiter ??= new FirecrawlLimiter()
  return globalForLimiter.__firecrawlLimiter
}

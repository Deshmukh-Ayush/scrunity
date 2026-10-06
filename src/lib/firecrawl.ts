/**
 * Firecrawl Web Search & Scraping Client
 * Reuses existing FIRECRAWL_API_KEY without duplicate config or paid third-party enrichment APIs.
 */

export interface ScrapeResult {
  url: string;
  title?: string;
  description?: string;
  markdown?: string;
  ogImage?: string;
  favicon?: string;
  keywords?: string[];
  links?: string[];
}

export interface SearchResultItem {
  title: string;
  description: string;
  url: string;
  markdown?: string;
}

const AGGREGATOR_DOMAINS = new Set([
  "g2.com",
  "www.g2.com",
  "capterra.com",
  "www.capterra.com",
  "producthunt.com",
  "www.producthunt.com",
  "trustradius.com",
  "www.trustradius.com",
  "softwareadvice.com",
  "www.softwareadvice.com",
  "getapp.com",
  "www.getapp.com",
  "clutch.co",
  "www.clutch.co",
  "wikipedia.org",
  "en.wikipedia.org",
  "youtube.com",
  "www.youtube.com",
  "linkedin.com",
  "www.linkedin.com",
  "medium.com",
  "reddit.com",
  "www.reddit.com",
  "quora.com",
  "www.quora.com",
  "github.com",
  "twitter.com",
  "x.com",
  "facebook.com",
  "instagram.com",
]);

/**
 * Extracts a normalized hostname/domain from a URL or raw domain string.
 */
export function extractDomain(rawUrl: string): string {
  try {
    let normalized = rawUrl.trim();
    if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
      normalized = `https://${normalized}`;
    }
    const parsed = new URL(normalized);
    return parsed.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return rawUrl.trim().toLowerCase();
  }
}

/**
 * Checks if a domain is a known aggregator, directory, or social site.
 */
export function isAggregatorOrReviewDomain(domain: string): boolean {
  const clean = domain.replace(/^www\./, "").toLowerCase();
  if (AGGREGATOR_DOMAINS.has(clean)) return true;
  for (const agg of AGGREGATOR_DOMAINS) {
    if (clean.endsWith(`.${agg}`)) return true;
  }
  return false;
}

/**
 * Resolves a high-quality favicon / logo URL for any domain.
 */
export function getFallbackLogoUrl(domain: string): string {
  const cleanDomain = extractDomain(domain);
  return `https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=128`;
}

import type { InngestStep } from "@/inngest/functions/shared";

export interface FirecrawlRetryOptions {
  step?: InngestStep;
  stepPrefix?: string;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export class FirecrawlRateLimitError extends Error {
  public readonly statusCode = 429;
  public readonly retryAttempts: number;
  public readonly lastDelayMs: number;
  public readonly endpoint: string;

  constructor(endpoint: string, retryAttempts: number, lastDelayMs: number) {
    super(
      `Firecrawl rate limit (429) exceeded for ${endpoint} after ${retryAttempts} retries.`
    );
    this.name = "FirecrawlRateLimitError";
    this.endpoint = endpoint;
    this.retryAttempts = retryAttempts;
    this.lastDelayMs = lastDelayMs;
  }
}

// Test hook for simulating Firecrawl responses in test suites
type FirecrawlTestInterceptor = (
  url: string,
  init: RequestInit
) => Promise<Response | null>;

let testInterceptor: FirecrawlTestInterceptor | null = null;

export function __setTestFirecrawlInterceptor(
  interceptor: FirecrawlTestInterceptor | null
) {
  testInterceptor = interceptor;
}

/**
 * Extracts wait duration from 429 response headers or body with exponential fallback.
 */
export function extractRetryDelay(
  res: Response,
  bodyText: string,
  attempt: number,
  options?: FirecrawlRetryOptions
): { delayMs: number; source: "header" | "body" | "exponential" } {
  const maxDelayMs = options?.maxDelayMs ?? 15000;
  const baseDelayMs = options?.baseDelayMs ?? 1000;

  // 1. Retry-After header (seconds or HTTP date)
  const retryAfter = res.headers.get("retry-after");
  if (retryAfter) {
    const seconds = parseFloat(retryAfter);
    if (!isNaN(seconds) && seconds > 0) {
      return {
        delayMs: Math.min(Math.round(seconds * 1000), maxDelayMs),
        source: "header",
      };
    }
    const parsedDate = Date.parse(retryAfter);
    if (!isNaN(parsedDate)) {
      const diff = parsedDate - Date.now();
      if (diff > 0) {
        return {
          delayMs: Math.min(diff, maxDelayMs),
          source: "header",
        };
      }
    }
  }

  // 2. x-ratelimit-reset header
  const resetHeader = res.headers.get("x-ratelimit-reset");
  if (resetHeader) {
    const val = parseFloat(resetHeader);
    if (!isNaN(val) && val > 0) {
      if (val > 1_000_000_000_000) {
        const diff = val - Date.now();
        if (diff > 0) return { delayMs: Math.min(diff, maxDelayMs), source: "header" };
      } else if (val > 1_000_000_000) {
        const diff = val * 1000 - Date.now();
        if (diff > 0) return { delayMs: Math.min(diff, maxDelayMs), source: "header" };
      } else {
        return {
          delayMs: Math.min(Math.round(val * 1000), maxDelayMs),
          source: "header",
        };
      }
    }
  }

  // 3. JSON body retry signals
  try {
    const json = JSON.parse(bodyText);
    if (typeof json.retryAfter === "number" && json.retryAfter > 0) {
      return {
        delayMs: Math.min(Math.round(json.retryAfter * 1000), maxDelayMs),
        source: "body",
      };
    }
    const errorMsg = json.error || json.message;
    if (typeof errorMsg === "string") {
      const match = errorMsg.match(
        /(?:retry after|try again in|wait)\s+(\d+(?:\.\d+)?)\s*(?:s|sec|seconds)?/i
      );
      if (match) {
        const secs = parseFloat(match[1]);
        if (!isNaN(secs) && secs > 0) {
          return {
            delayMs: Math.min(Math.round(secs * 1000), maxDelayMs),
            source: "body",
          };
        }
      }
    }
  } catch {
    // Non-JSON body
  }

  // 4. Exponential backoff fallback (1s, 2s, 4s, 8s...) + jitter
  const expDelay = baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.floor(Math.random() * 400);
  const calculated = Math.min(expDelay + jitter, maxDelayMs);

  return { delayMs: calculated, source: "exponential" };
}

/**
 * Checkpoints a sleep wait using Inngest step if provided, or setTimeout otherwise.
 */
export async function sleepWithStep(
  waitMs: number,
  step?: InngestStep,
  stepId?: string
): Promise<void> {
  const waitSeconds = Math.max(1, Math.ceil(waitMs / 1000));
  const safeStepId = (stepId || `fc-sleep-${Date.now()}`)
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .slice(0, 64);

  if (step && typeof step.sleep === "function") {
    await step.sleep(safeStepId, `${waitSeconds}s`);
  } else if (step && typeof step.run === "function") {
    await step.run(safeStepId, async () => {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    });
  } else {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
}

/**
 * Shared fetch helper for Firecrawl API calls with durable 429 retry backoff.
 */
export async function firecrawlFetchWithRetry(
  url: string,
  payload: any,
  options?: FirecrawlRetryOptions
): Promise<Response> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  const maxRetries = options?.maxRetries ?? 3;
  const step = options?.step;
  const stepPrefix = options?.stepPrefix || "firecrawl";

  let lastDelayMs = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const init: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    };

    let res: Response;
    try {
      if (testInterceptor) {
        const intercepted = await testInterceptor(url, init);
        if (intercepted) {
          res = intercepted;
        } else {
          res = await fetch(url, init);
        }
      } else {
        res = await fetch(url, init);
      }
    } catch (netErr: any) {
      clearTimeout(timeoutId);
      if (attempt < maxRetries) {
        console.warn(
          `[Firecrawl] Network error on attempt ${attempt + 1}: ${netErr.message}. Retrying...`
        );
        const waitMs = 1000 * Math.pow(2, attempt);
        await sleepWithStep(
          waitMs,
          step,
          `${stepPrefix}-net-backoff-${attempt}`
        );
        continue;
      }
      throw netErr;
    }

    clearTimeout(timeoutId);

    if (res.status === 429) {
      const bodyClone = await res.clone().text();
      const { delayMs, source } = extractRetryDelay(
        res,
        bodyClone,
        attempt,
        options
      );
      lastDelayMs = delayMs;

      console.warn(
        `[Firecrawl 429] Rate limit hit on ${url} (attempt ${attempt + 1}/${maxRetries + 1}). ` +
          `Backoff wait: ${delayMs}ms (source: ${source}).`
      );

      if (attempt < maxRetries) {
        await sleepWithStep(
          delayMs,
          step,
          `${stepPrefix}-429-backoff-${attempt}`
        );
        continue;
      } else {
        throw new FirecrawlRateLimitError(url, maxRetries, lastDelayMs);
      }
    }

    return res;
  }

  throw new FirecrawlRateLimitError(url, maxRetries, lastDelayMs);
}

/**
 * Scrapes a single URL via Firecrawl v1 API.
 * Falls back to basic HTML fetch if Firecrawl fails or times out.
 */
export async function scrapeUrl(
  url: string,
  options?: FirecrawlRetryOptions
): Promise<ScrapeResult> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  let formattedUrl = url.trim();
  if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
    formattedUrl = `https://${formattedUrl}`;
  }

  if (apiKey) {
    try {
      const res = await firecrawlFetchWithRetry(
        "https://api.firecrawl.dev/v1/scrape",
        {
          url: formattedUrl,
          formats: ["markdown", "html"],
        },
        options
      );

      if (res.ok) {
        const json = await res.json();
        const data = json.data || json;
        const meta = data.metadata || {};

        let keywords: string[] = [];
        if (meta.keywords) {
          if (Array.isArray(meta.keywords)) {
            keywords = meta.keywords;
          } else if (typeof meta.keywords === "string") {
            keywords = meta.keywords
              .split(",")
              .map((k: string) => k.trim())
              .filter(Boolean);
          }
        }

        return {
          url: formattedUrl,
          title: meta.title || meta["og:title"],
          description: meta.description || meta["og:description"],
          markdown: data.markdown || "",
          ogImage: meta.ogImage || meta["og:image"],
          favicon: meta.favicon || getFallbackLogoUrl(formattedUrl),
          keywords,
          links: data.links || [],
        };
      }
    } catch (err) {
      if (err instanceof FirecrawlRateLimitError) {
        throw err;
      }
      console.warn(`[Firecrawl scrape] API error for ${formattedUrl}:`, err);
    }
  }

  // Graceful fallback: basic HTML fetch
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const fallbackRes = await fetch(formattedUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (fallbackRes.ok) {
      const html = await fallbackRes.text();
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const descMatch = html.match(
        /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i
      ) || html.match(
        /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i
      );
      const ogImageMatch = html.match(
        /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i
      );
      const keywordsMatch = html.match(
        /<meta[^>]*name=["']keywords["'][^>]*content=["']([^"']+)["']/i
      );

      const title = titleMatch ? titleMatch[1].trim() : undefined;
      const description = descMatch ? descMatch[1].trim() : undefined;
      const ogImage = ogImageMatch ? ogImageMatch[1].trim() : undefined;
      const keywords = keywordsMatch
        ? keywordsMatch[1].split(",").map((k) => k.trim()).filter(Boolean)
        : [];

      return {
        url: formattedUrl,
        title,
        description,
        markdown: html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 4000),
        ogImage,
        favicon: getFallbackLogoUrl(formattedUrl),
        keywords,
      };
    }
  } catch (fallbackErr) {
    console.warn(`[Fallback scrape] Failed for ${formattedUrl}:`, fallbackErr);
  }

  return {
    url: formattedUrl,
    favicon: getFallbackLogoUrl(formattedUrl),
  };
}

/**
 * Searches the web via Firecrawl v1 API with 429 retry backoff.
 */
export async function searchFirecrawl(
  query: string,
  limit: number = 5,
  options?: FirecrawlRetryOptions
): Promise<SearchResultItem[]> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    console.warn("[Firecrawl Search] FIRECRAWL_API_KEY not configured.");
    return [];
  }

  try {
    const res = await firecrawlFetchWithRetry(
      "https://api.firecrawl.dev/v1/search",
      { query, limit },
      options
    );

    if (res.ok) {
      const json = await res.json();
      const rawList = Array.isArray(json.data)
        ? json.data
        : Array.isArray(json.results)
        ? json.results
        : Array.isArray(json.data?.web)
        ? json.data.web
        : [];

      return rawList.map((item: any) => ({
        title: item.title || "Web Result",
        description:
          item.description ||
          (item.markdown ? item.markdown.slice(0, 300).trim() : ""),
        url: item.url || "",
        markdown: item.markdown,
      }));
    } else {
      const err = await res.text();
      console.warn(`[Firecrawl Search] HTTP ${res.status}: ${err}`);
    }
  } catch (err) {
    if (err instanceof FirecrawlRateLimitError) {
      throw err;
    }
    console.warn(`[Firecrawl Search] Network error for "${query}":`, err);
  }

  return [];
}

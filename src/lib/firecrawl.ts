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
 * Normalizes user-entered website URLs, stripping duplicate protocols (e.g. https://https://),
 * trailing slashes, leading slashes, and ensuring a valid https:// scheme.
 */
export function normalizeWebsiteUrl(rawUrl: string): string {
  let clean = rawUrl.trim();
  if (!clean) return "";
  // Strip duplicate or malformed protocol prefixes like https://https://, http://https://, https:///
  clean = clean.replace(/^(?:https?:\/*)+/i, "");
  return `https://${clean}`;
}

/**
 * Extracts a normalized hostname/domain from a URL or raw domain string.
 */
export function extractDomain(rawUrl: string): string {
  try {
    const normalized = normalizeWebsiteUrl(rawUrl);
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

/**
 * Discovers an About / Company page URL from scraped links and markdown.
 */
export function findAboutPageUrl(
  baseUrl: string,
  links?: string[],
  markdown?: string
): string | null {
  let base: URL;
  try {
    const formatted = normalizeWebsiteUrl(baseUrl);
    base = new URL(formatted);
  } catch {
    return null;
  }

  const baseHost = base.hostname.replace(/^www\./, "").toLowerCase();

  const candidates: string[] = [];
  if (Array.isArray(links)) {
    for (const l of links) {
      if (typeof l === "string" && l.trim()) candidates.push(l.trim());
    }
  }

  if (markdown) {
    const mdRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]+)\)/gi;
    let match;
    while ((match = mdRegex.exec(markdown)) !== null) {
      const label = match[1].toLowerCase();
      const href = match[2];
      if (
        /about|company|who we are|our story|team/i.test(label) ||
        /about|company/i.test(href)
      ) {
        candidates.push(href);
      }
    }
  }

  interface ScoredCandidate {
    url: string;
    score: number;
  }

  const scored: ScoredCandidate[] = [];

  for (const raw of candidates) {
    try {
      if (/^(javascript:|mailto:|tel:|#)/i.test(raw)) continue;

      const resolved = new URL(raw, base.origin);
      const host = resolved.hostname.replace(/^www\./, "").toLowerCase();

      // Must belong to the same root domain
      if (host !== baseHost && !host.endsWith(`.${baseHost}`)) {
        continue;
      }

      const pathname = resolved.pathname.replace(/\/+$/, "").toLowerCase();
      const basePathname = base.pathname.replace(/\/+$/, "").toLowerCase();
      if (!pathname || pathname === basePathname) {
        continue;
      }

      // Filter out non-about pages
      if (
        pathname.startsWith("/blog/") ||
        pathname.startsWith("/changelog/") ||
        pathname.startsWith("/terms") ||
        pathname.startsWith("/privacy") ||
        pathname.startsWith("/pricing") ||
        pathname.startsWith("/contact") ||
        pathname.startsWith("/docs") ||
        pathname.startsWith("/api")
      ) {
        continue;
      }

      let score = 0;
      if (pathname === "/about" || pathname === "/about-us") {
        score = 100;
      } else if (pathname === "/company") {
        score = 90;
      } else if (pathname === "/our-story" || pathname === "/who-we-are") {
        score = 85;
      } else if (pathname === "/company/about" || pathname === "/about/company") {
        score = 80;
      } else if (pathname.endsWith("/about") || pathname.endsWith("/about-us")) {
        score = 70;
      } else if (pathname.startsWith("/about/")) {
        score = 60;
      } else if (pathname.startsWith("/company/")) {
        score = 50;
      }

      if (score > 0) {
        const cleanUrl = `${resolved.origin}${resolved.pathname}`;
        scored.push({ url: cleanUrl, score });
      }
    } catch {
      // Ignore malformed URL
    }
  }

  if (scored.length === 0) return null;

  scored.sort((a, b) => b.score - a.score);
  return scored[0].url;
}

import type { InngestStep } from "@/inngest/functions/shared";
import {
  checkFirecrawlCallAllowed,
  recordFirecrawlUsage,
  FirecrawlCallCapExceededError,
  FirecrawlSpendPausedError,
  type FirecrawlRunContext,
} from "@/lib/firecrawl-spend";

export {
  FirecrawlCallCapExceededError,
  FirecrawlSpendPausedError,
  type FirecrawlRunContext,
};

export interface FirecrawlRetryOptions {
  step?: InngestStep;
  stepPrefix?: string;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  runContext?: FirecrawlRunContext;
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

let lastFirecrawlRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 1500;

async function throttleFirecrawlRequest() {
  const now = Date.now();
  const diff = now - lastFirecrawlRequestTime;
  if (diff < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((r) => setTimeout(r, MIN_REQUEST_INTERVAL_MS - diff));
  }
  lastFirecrawlRequestTime = Date.now();
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
  const maxRetries = options?.maxRetries ?? 2;
  const step = options?.step;
  const stepPrefix = options?.stepPrefix || "firecrawl";

  let lastDelayMs = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    await throttleFirecrawlRequest();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

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
  const formattedUrl = normalizeWebsiteUrl(url);

  if (apiKey) {
    if (options?.runContext) {
      await checkFirecrawlCallAllowed(options.runContext);
    }
    try {
      const res = await firecrawlFetchWithRetry(
        "https://api.firecrawl.dev/v1/scrape",
        {
          url: formattedUrl,
          formats: ["markdown", "html", "links"],
        },
        options
      );

      if (options?.runContext) {
        await recordFirecrawlUsage({
          ...options.runContext,
          units: 1,
          metadata: { endpoint: "scrape", url: formattedUrl },
        });
      }

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
      if (
        err instanceof FirecrawlRateLimitError ||
        err instanceof FirecrawlCallCapExceededError ||
        err instanceof FirecrawlSpendPausedError
      ) {
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
      const linkMatches = [
        ...html.matchAll(/<a[^>]+href=["']([^"'#]+)["']/gi),
      ].map((m) => m[1]);

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
        links: linkMatches,
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

  if (options?.runContext) {
    await checkFirecrawlCallAllowed(options.runContext);
  }

  try {
    const res = await firecrawlFetchWithRetry(
      "https://api.firecrawl.dev/v1/search",
      { query, limit },
      options
    );

    if (options?.runContext) {
      await recordFirecrawlUsage({
        ...options.runContext,
        units: 1,
        metadata: { endpoint: "search", query, limit },
      });
    }

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
    if (
      err instanceof FirecrawlRateLimitError ||
      err instanceof FirecrawlCallCapExceededError ||
      err instanceof FirecrawlSpendPausedError
    ) {
      throw err;
    }
    console.warn(`[Firecrawl Search] Network error for "${query}":`, err);
  }

  return [];
}

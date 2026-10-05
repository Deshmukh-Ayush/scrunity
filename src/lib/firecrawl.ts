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

/**
 * Scrapes a single URL via Firecrawl v1 API.
 * Falls back to basic HTML fetch if Firecrawl fails or times out.
 */
export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  let formattedUrl = url.trim();
  if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
    formattedUrl = `https://${formattedUrl}`;
  }

  if (apiKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 18000);

      const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          url: formattedUrl,
          formats: ["markdown", "html"],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

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
 * Searches the web via Firecrawl v1 API.
 */
export async function searchFirecrawl(
  query: string,
  limit: number = 5
): Promise<SearchResultItem[]> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    console.warn("[Firecrawl Search] FIRECRAWL_API_KEY not configured.");
    return [];
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const res = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query, limit }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

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
    console.warn(`[Firecrawl Search] Network error for "${query}":`, err);
  }

  return [];
}

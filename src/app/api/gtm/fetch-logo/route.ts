import { NextRequest, NextResponse } from "next/server";
import { extractDomain, getFallbackLogoUrl, scrapeUrl, normalizeWebsiteUrl } from "@/lib/firecrawl";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawUrl = searchParams.get("url");

    if (!rawUrl || !rawUrl.trim()) {
      return NextResponse.json({ error: "URL parameter is required" }, { status: 400 });
    }

    const cleanUrl = normalizeWebsiteUrl(rawUrl);
    const domain = extractDomain(cleanUrl);
    const fallbackLogo = getFallbackLogoUrl(domain);

    // Attempt to scrape with a fast 2.5s timeout; degrade gracefully if slow/failed
    let resolvedLogo = fallbackLogo;
    try {
      const timeoutPromise = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("Logo scrape timeout")), 2500)
      );
      const scrapePromise = scrapeUrl(cleanUrl);
      const scraped = await Promise.race([scrapePromise, timeoutPromise]);
      if (scraped && (scraped.ogImage || scraped.favicon)) {
        resolvedLogo = scraped.ogImage || scraped.favicon || fallbackLogo;
      }
    } catch {
      // Degrade gracefully to fallback Google favicon
    }

    return NextResponse.json({
      success: true,
      logoUrl: resolvedLogo,
      domain,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error fetching logo";
    return NextResponse.json({
      success: true,
      logoUrl: null,
      error: msg,
    });
  }
}

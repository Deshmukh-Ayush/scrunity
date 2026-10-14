import { NextRequest, NextResponse } from "next/server";
import { extractDomain, getFallbackLogoUrl, normalizeWebsiteUrl } from "@/lib/firecrawl";
import { resolveAuthAndOrg } from "@/lib/gtm-auth";
import { QUOTAS, consumeOrgQuota } from "@/lib/org-quota";

/**
 * Logo for a website. Never calls Firecrawl (it used to scrape with no cap):
 * returns the favicon-service URL, which is free and deterministic. Capped per
 * organization per day and cacheable by the browser for a day.
 */
export async function GET(req: NextRequest) {
  const { auth, error, status } = await resolveAuthAndOrg(req.headers);
  if (error || !auth) {
    return NextResponse.json({ error: error || "Unauthorized" }, { status: status || 401 });
  }

  const rawUrl = new URL(req.url).searchParams.get("url");
  if (!rawUrl || !rawUrl.trim()) {
    return NextResponse.json({ error: "URL parameter is required" }, { status: 400 });
  }

  const quota = await consumeOrgQuota(auth.orgId, QUOTAS.logoFetch);
  if (!quota.allowed) {
    return NextResponse.json({ error: quota.message, quotaExceeded: true }, { status: 429 });
  }

  const domain = extractDomain(normalizeWebsiteUrl(rawUrl));
  return NextResponse.json(
    { success: true, logoUrl: getFallbackLogoUrl(domain), domain },
    { headers: { "Cache-Control": "private, max-age=86400" } }
  );
}

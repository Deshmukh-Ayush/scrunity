import { researchRunChannel } from "../client";
import { db } from "@/utils/db";
import { gtmResearchRun, type SynthesizedCompanyProfile } from "@/db/schema";
import { eq } from "drizzle-orm";
import { advanceResearchRun } from "@/lib/pipeline/stage-state";
import {
  scrapeUrl,
  searchFirecrawl,
  findAboutPageUrl,
  getFallbackLogoUrl,
  FirecrawlRateLimitError,
  FirecrawlCallCapExceededError,
  FirecrawlSpendPausedError,
  type SearchResultItem,
  type ScrapeResult,
} from "@/lib/firecrawl";
import { synthesizeCompanyProfile } from "@/lib/gtm-ai";
import { formatTargetMarket } from "@/lib/geo/countries";
import { safeRealtimePublish, type InngestStep } from "./shared";

export interface ResearchCompanyResult {
  companyName: string;
  companyDescription: string;
  contextDoc: string | null;
  websiteUrl: string;
  companySize?: string;
  synthesizedProfile?: SynthesizedCompanyProfile;
  rateLimitSummary?: string;
}

/**
 * Stage 1 Execution Logic: Research Company
 */
export async function executeResearchCompany(
  researchRunId: string,
  step?: InngestStep
): Promise<ResearchCompanyResult> {
  const [run] = await db
    .select()
    .from(gtmResearchRun)
    .where(eq(gtmResearchRun.id, researchRunId));

  if (!run) {
    throw new Error(`Research run ${researchRunId} not found`);
  }

  // Ownership of the stage (and the in_progress status) is established by
  // claimResearchStage before this runs; never rewrite currentStage here.
  await db
    .update(gtmResearchRun)
    .set({ lastProgressAt: new Date() })
    .where(eq(gtmResearchRun.id, researchRunId));

  await safeRealtimePublish(researchRunChannel(researchRunId).started, {
    stage: "research_company",
    message: `Analyzing ${run.companyName} (${run.websiteUrl})...`,
  });

  const runContext = {
    researchRunId,
    organizationId: run.organizationId,
  };

  // 1. Scrape homepage
  let homepageScrape: ScrapeResult;
  try {
    homepageScrape = await scrapeUrl(run.websiteUrl, {
      step,
      stepPrefix: "stage1-homepage",
      runContext,
    });
  } catch (err) {
    if (
      err instanceof FirecrawlCallCapExceededError ||
      err instanceof FirecrawlSpendPausedError
    ) {
      throw err;
    }
    console.warn(`[Stage 1] Homepage scrape for ${run.websiteUrl} failed, using fallback metadata:`, err);
    homepageScrape = {
      url: run.websiteUrl,
      title: run.companyName,
      description: run.companyDescription,
      favicon: getFallbackLogoUrl(run.websiteUrl),
    };
  }

  // 2. Discover and scrape About / Company page if found
  const aboutUrl = findAboutPageUrl(
    run.websiteUrl,
    homepageScrape.links,
    homepageScrape.markdown
  );

  let aboutScrape: ScrapeResult | null = null;
  if (aboutUrl) {
    try {
      aboutScrape = await scrapeUrl(aboutUrl, {
        step,
        stepPrefix: "stage1-about",
        runContext,
      });
    } catch (err) {
      if (
        err instanceof FirecrawlCallCapExceededError ||
        err instanceof FirecrawlSpendPausedError
      ) {
        throw err;
      }
      if (err instanceof FirecrawlRateLimitError) {
        console.warn(`[Stage 1] About-page scrape for ${aboutUrl} hit Firecrawl rate limits.`);
      } else {
        console.warn(`[Stage 1] Failed to scrape about-page ${aboutUrl}:`, err);
      }
    }
  }

  // 3. Combine homepage + about page content
  const combinedScrapedSections: string[] = [];
  if (homepageScrape.title) {
    combinedScrapedSections.push(`Homepage Title: ${homepageScrape.title}`);
  }
  if (homepageScrape.description) {
    combinedScrapedSections.push(`Homepage Description: ${homepageScrape.description}`);
  }
  if (homepageScrape.markdown) {
    combinedScrapedSections.push(`Homepage Content:\n${homepageScrape.markdown.slice(0, 5000)}`);
  }
  if (aboutScrape?.title) {
    combinedScrapedSections.push(`About Page Title: ${aboutScrape.title}`);
  }
  if (aboutScrape?.description) {
    combinedScrapedSections.push(`About Page Description: ${aboutScrape.description}`);
  }
  if (aboutScrape?.markdown) {
    combinedScrapedSections.push(`About Page Content:\n${aboutScrape.markdown.slice(0, 5000)}`);
  }
  const scrapedContent = combinedScrapedSections.join("\n\n");

  // 4. Run LLM synthesis to produce structured company profile
  let synthesizedProfile: SynthesizedCompanyProfile | null = null;
  try {
    synthesizedProfile = await synthesizeCompanyProfile({
      companyName: run.companyName,
      websiteUrl: run.websiteUrl,
      companySize: run.companySize,
      companyDescription: run.companyDescription,
      contextDoc: run.contextDoc,
      scrapedContent: scrapedContent || run.companyDescription,
      targetMarket: formatTargetMarket(run.targetCountryCode, run.targetRegion),
    });
  } catch (err) {
    console.warn(`[Stage 1] Company profile synthesis failed, using basic profile:`, err);
    synthesizedProfile = {
      summary: run.companyDescription,
      industry: "Technology & Software",
      productFocus: run.companyName,
      targetCustomerLanguage: "B2B / Direct Clients",
      signals: [run.companyDescription],
    };
  }

  // 2. Discover social presence
  const cleanName = run.companyName.trim();
  let linkedinResults: SearchResultItem[] = [];
  let twitterResults: SearchResultItem[] = [];
  let instagramResults: SearchResultItem[] = [];
  let socialRateLimited = false;

  try {
    linkedinResults = await searchFirecrawl(
      `"${cleanName}" site:linkedin.com/company`,
      2,
      { step, stepPrefix: "stage1-social-li", runContext }
    );
  } catch (err) {
    if (
      err instanceof FirecrawlCallCapExceededError ||
      err instanceof FirecrawlSpendPausedError
    ) {
      throw err;
    }
    if (err instanceof FirecrawlRateLimitError) socialRateLimited = true;
  }

  try {
    twitterResults = await searchFirecrawl(
      `"${cleanName}" site:x.com OR site:twitter.com`,
      2,
      { step, stepPrefix: "stage1-social-tw", runContext }
    );
  } catch (err) {
    if (
      err instanceof FirecrawlCallCapExceededError ||
      err instanceof FirecrawlSpendPausedError
    ) {
      throw err;
    }
    if (err instanceof FirecrawlRateLimitError) socialRateLimited = true;
  }

  try {
    instagramResults = await searchFirecrawl(
      `"${cleanName}" site:instagram.com`,
      2,
      { step, stepPrefix: "stage1-social-ig", runContext }
    );
  } catch (err) {
    if (
      err instanceof FirecrawlCallCapExceededError ||
      err instanceof FirecrawlSpendPausedError
    ) {
      throw err;
    }
    if (err instanceof FirecrawlRateLimitError) socialRateLimited = true;
  }

  const linkedinUrl =
    linkedinResults.find((r) => r.url.includes("linkedin.com/company/"))?.url || null;
  const twitterUrl =
    twitterResults.find(
      (r) => r.url.includes("x.com/") || r.url.includes("twitter.com/")
    )?.url || null;
  const instagramUrl =
    instagramResults.find((r) => r.url.includes("instagram.com/"))?.url || null;

  const logoUrl =
    run.logoUrl ||
    homepageScrape.ogImage ||
    homepageScrape.favicon ||
    getFallbackLogoUrl(run.websiteUrl);

  const seoKeywords =
    homepageScrape.keywords && homepageScrape.keywords.length > 0
      ? homepageScrape.keywords
      : null;

  // Save findings and move to Stage 2 (only if the run is still at Stage 1)
  await advanceResearchRun(researchRunId, "research_company", {
    logoUrl,
    linkedinUrl,
    twitterUrl,
    instagramUrl,
    seoKeywords,
    synthesizedProfile,
    currentStage: "research_competitors",
  });

  const summary = socialRateLimited
    ? `Homepage & about research synthesized. Social search hit Firecrawl rate limits; branding partially discovered.`
    : `Homepage & about research synthesized with structured company profile. Social presence and branding discovered.`;

  await safeRealtimePublish(researchRunChannel(researchRunId).completed, {
    stage: "research_company",
    summary,
  });

  return {
    companyName: run.companyName,
    companyDescription: run.companyDescription,
    contextDoc: run.contextDoc,
    websiteUrl: run.websiteUrl,
    companySize: run.companySize,
    synthesizedProfile: synthesizedProfile || undefined,
    rateLimitSummary: socialRateLimited
      ? "social search hit Firecrawl rate limits"
      : undefined,
  };
}

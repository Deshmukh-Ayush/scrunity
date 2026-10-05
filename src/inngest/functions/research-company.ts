import { inngest, researchRunChannel, type GtmEvents } from "../client";
import { db } from "@/utils/db";
import { gtmResearchRun } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  scrapeUrl,
  searchFirecrawl,
  getFallbackLogoUrl,
} from "@/lib/firecrawl";
import { safeRealtimePublish, type InngestStep } from "./shared";

export interface ResearchCompanyResult {
  companyName: string;
  companyDescription: string;
  contextDoc: string | null;
  websiteUrl: string;
}

/**
 * Stage 1 Execution Logic: Research Company
 */
export async function executeResearchCompany(
  researchRunId: string
): Promise<ResearchCompanyResult> {
  const [run] = await db
    .select()
    .from(gtmResearchRun)
    .where(eq(gtmResearchRun.id, researchRunId));

  if (!run) {
    throw new Error(`Research run ${researchRunId} not found`);
  }

  await db
    .update(gtmResearchRun)
    .set({ currentStage: "research_company", status: "in_progress" })
    .where(eq(gtmResearchRun.id, researchRunId));

  await safeRealtimePublish(researchRunChannel(researchRunId).started, {
    stage: "research_company",
    message: `Analyzing ${run.companyName} (${run.websiteUrl})...`,
  });

  // 1. Scrape homepage
  const homepageScrape = await scrapeUrl(run.websiteUrl);

  // 2. Discover social presence
  const cleanName = run.companyName.trim();
  const [linkedinResults, twitterResults, instagramResults] =
    await Promise.all([
      searchFirecrawl(`"${cleanName}" site:linkedin.com/company`, 2),
      searchFirecrawl(`"${cleanName}" site:x.com OR site:twitter.com`, 2),
      searchFirecrawl(`"${cleanName}" site:instagram.com`, 2),
    ]);

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

  // Update research run
  await db
    .update(gtmResearchRun)
    .set({
      logoUrl,
      linkedinUrl,
      twitterUrl,
      instagramUrl,
      seoKeywords,
      currentStage: "research_competitors",
    })
    .where(eq(gtmResearchRun.id, researchRunId));

  await safeRealtimePublish(researchRunChannel(researchRunId).completed, {
    stage: "research_company",
    summary: `Homepage analyzed. Social presence and branding discovered.`,
  });

  return {
    companyName: run.companyName,
    companyDescription: run.companyDescription,
    contextDoc: run.contextDoc,
    websiteUrl: run.websiteUrl,
  };
}

/**
 * Inngest Function: Stage 1 - Research Company
 */
export const researchCompanyFunction = inngest.createFunction(
  {
    id: "gtm-stage-1-research-company",
    name: "GTM Stage 1: Research Company",
    triggers: [{ event: "gtm/research.requested" }],
  },
  async ({
    event,
    step,
  }: {
    event: GtmEvents["gtm/research.requested"];
    step: InngestStep;
  }) => {
    const { researchRunId } = event.data;

    const result = await step.run("stage-1-research-company", async () => {
      return await executeResearchCompany(researchRunId);
    });

    // Automatically trigger Stage 2: Explore Competitors
    await step.sendEvent("trigger-stage-2-explore-competitors", {
      name: "gtm/research.explore_competitors",
      data: { researchRunId },
    });

    return result;
  }
);

import { inngest, researchRunChannel, type GtmEvents } from "../client";
import { db } from "@/utils/db";
import { gtmResearchRun, gtmCompetitor } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  scrapeUrl,
  searchFirecrawl,
  extractDomain,
  isAggregatorOrReviewDomain,
  getFallbackLogoUrl,
} from "@/lib/firecrawl";
import { generateCompetitorSearchQueries } from "@/lib/gtm-ai";
import { safeRealtimePublish, type InngestStep } from "./shared";

export interface ExploreCompetitorsResult {
  competitorCount: number;
}

/**
 * Stage 2 Execution Logic: Explore Competitors
 */
export async function executeExploreCompetitors(
  researchRunId: string
): Promise<ExploreCompetitorsResult> {
  const [run] = await db
    .select()
    .from(gtmResearchRun)
    .where(eq(gtmResearchRun.id, researchRunId));

  if (!run) {
    throw new Error(`Research run ${researchRunId} not found`);
  }

  await safeRealtimePublish(researchRunChannel(researchRunId).started, {
    stage: "research_competitors",
    message: "Identifying and evaluating commercial competitors...",
  });

  // 1. Generate 3-5 search queries via AI
  const queries = await generateCompetitorSearchQueries({
    companyName: run.companyName,
    companyDescription: run.companyDescription,
    contextDoc: run.contextDoc,
  });

  // 2. Run searches via Firecrawl
  const searchResults = await Promise.all(
    queries.map((q) => searchFirecrawl(q, 6))
  );

  const ownDomain = extractDomain(run.websiteUrl);
  const candidateDomains = new Map<
    string,
    { title: string; description: string; url: string }
  >();

  for (const list of searchResults) {
    for (const item of list) {
      const dom = extractDomain(item.url);
      if (!dom || dom === ownDomain || isAggregatorOrReviewDomain(dom)) {
        continue;
      }
      if (!candidateDomains.has(dom)) {
        candidateDomains.set(dom, item);
      }
    }
  }

  // Cap at ~15 candidate domains, scrape top 6-8 for structured details
  const domainList = Array.from(candidateDomains.keys()).slice(0, 10);
  const competitorsToInsert: Array<{
    researchRunId: string;
    name: string;
    domain: string;
    description: string;
    keywords: string[];
    logoUrl: string;
  }> = [];

  for (const dom of domainList) {
    const item = candidateDomains.get(dom)!;
    let desc = item.description || "";
    let name = item.title.split(/[-–|:]/)[0].trim() || dom;

    let logo = getFallbackLogoUrl(dom);
    let keywords: string[] = [];

    if (desc.length < 30) {
      try {
        const scraped = await scrapeUrl(`https://${dom}`);
        if (scraped.description) desc = scraped.description;
        if (scraped.title && !name) name = scraped.title.split(/[-–|:]/)[0].trim();
        if (scraped.ogImage || scraped.favicon) logo = scraped.ogImage || scraped.favicon!;
        if (scraped.keywords) keywords = scraped.keywords;
      } catch (e) {
        console.warn(`Competitor scrape skipped for ${dom}`);
      }
    }

    competitorsToInsert.push({
      researchRunId,
      name: name.slice(0, 100),
      domain: dom,
      description: desc.slice(0, 500) || `${name} competitive solution in this space.`,
      keywords,
      logoUrl: logo,
    });
  }

  if (competitorsToInsert.length > 0) {
    await db.insert(gtmCompetitor).values(competitorsToInsert);
  }

  await db
    .update(gtmResearchRun)
    .set({ currentStage: "define_segments" })
    .where(eq(gtmResearchRun.id, researchRunId));

  await safeRealtimePublish(researchRunChannel(researchRunId).completed, {
    stage: "research_competitors",
    summary: `Discovered and analyzed ${competitorsToInsert.length} competitors.`,
  });

  return { competitorCount: competitorsToInsert.length };
}

/**
 * Inngest Function: Stage 2 - Explore Competitors
 */
export const exploreCompetitorsFunction = inngest.createFunction(
  {
    id: "gtm-stage-2-explore-competitors",
    name: "GTM Stage 2: Explore Competitors",
    triggers: [{ event: "gtm/research.explore_competitors" }],
  },
  async ({
    event,
    step,
  }: {
    event: GtmEvents["gtm/research.explore_competitors"];
    step: InngestStep;
  }) => {
    const { researchRunId } = event.data;

    const result = await step.run("stage-2-explore-competitors", async () => {
      return await executeExploreCompetitors(researchRunId);
    });

    // Automatically trigger Stage 3: Define Segments
    await step.sendEvent("trigger-stage-3-define-segments", {
      name: "gtm/research.define_segments",
      data: { researchRunId },
    });

    return result;
  }
);

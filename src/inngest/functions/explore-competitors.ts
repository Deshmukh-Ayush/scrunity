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
  FirecrawlRateLimitError,
  type SearchResultItem,
} from "@/lib/firecrawl";
import { generateCompetitorSearchQueries } from "@/lib/gtm-ai";
import { safeRealtimePublish, type InngestStep } from "./shared";

export interface ExploreCompetitorsResult {
  competitorCount: number;
  rateLimitSummary?: string;
}

/**
 * Stage 2 Execution Logic: Explore Competitors
 */
export async function executeExploreCompetitors(
  researchRunId: string,
  step?: InngestStep
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

  // 2. Run searches via Firecrawl with retry & backoff
  const searchResults: SearchResultItem[][] = [];
  let successfulQueries = 0;
  let rateLimitedQueries = 0;

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    try {
      const results = await searchFirecrawl(q, 6, {
        step,
        stepPrefix: `stage2-comp-q-${i}`,
      });
      searchResults.push(results);
      successfulQueries++;
    } catch (err) {
      if (err instanceof FirecrawlRateLimitError) {
        rateLimitedQueries++;
        console.warn(
          `[Stage 2] Competitor query "${q}" hit rate limit after retries. Degrading gracefully.`
        );
      } else {
        throw err;
      }
    }
  }

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

  for (let dIdx = 0; dIdx < domainList.length; dIdx++) {
    const dom = domainList[dIdx];
    const item = candidateDomains.get(dom)!;
    let desc = item.description || "";
    let name = item.title.split(/[-–|:]/)[0].trim() || dom;

    let logo = getFallbackLogoUrl(dom);
    let keywords: string[] = [];

    if (desc.length < 30) {
      try {
        const scraped = await scrapeUrl(`https://${dom}`, {
          step,
          stepPrefix: `stage2-scrape-${dIdx}`,
        });
        if (scraped.description) desc = scraped.description;
        if (scraped.title && !name) name = scraped.title.split(/[-–|:]/)[0].trim();
        if (scraped.ogImage || scraped.favicon) logo = scraped.ogImage || scraped.favicon!;
        if (scraped.keywords) keywords = scraped.keywords;
      } catch (e) {
        console.warn(`Competitor scrape skipped for ${dom}:`, (e as Error).message);
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

  const rateLimitSummary =
    rateLimitedQueries > 0
      ? `competitor search hit rate limits, ${successfulQueries} of ${queries.length} queries completed`
      : undefined;

  const summary = rateLimitSummary
    ? `Discovered and analyzed ${competitorsToInsert.length} competitors (${rateLimitSummary}).`
    : `Discovered and analyzed ${competitorsToInsert.length} competitors.`;

  await safeRealtimePublish(researchRunChannel(researchRunId).completed, {
    stage: "research_competitors",
    summary,
  });

  return {
    competitorCount: competitorsToInsert.length,
    rateLimitSummary,
  };
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

    const result = await executeExploreCompetitors(researchRunId, step);

    // Automatically trigger Stage 3: Define Segments
    await step.sendEvent("trigger-stage-3-define-segments", {
      name: "gtm/research.define_segments",
      data: { researchRunId },
    });

    return result;
  }
);

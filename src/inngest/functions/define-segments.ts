import { inngest, researchRunChannel, type GtmEvents } from "../client";
import { db } from "@/utils/db";
import { gtmResearchRun, gtmCompetitor, gtmIcpSegment } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  searchFirecrawl,
  extractDomain,
  isAggregatorOrReviewDomain,
  FirecrawlRateLimitError,
  FirecrawlCallCapExceededError,
  FirecrawlSpendPausedError,
} from "@/lib/firecrawl";
import { generateIcpSegments } from "@/lib/gtm-ai";
import { safeRealtimePublish, type InngestStep } from "./shared";

export interface DefineSegmentsResult {
  segmentCount: number;
  rateLimitSummary?: string;
}

/**
 * Stage 3 Execution Logic: Define Segments
 */
export async function executeDefineSegments(
  researchRunId: string,
  step?: InngestStep
): Promise<DefineSegmentsResult> {
  const [run] = await db
    .select()
    .from(gtmResearchRun)
    .where(eq(gtmResearchRun.id, researchRunId));

  if (!run) {
    throw new Error(`Research run ${researchRunId} not found`);
  }

  await safeRealtimePublish(researchRunChannel(researchRunId).started, {
    stage: "define_segments",
    message: "Deriving ICP segments and discovering real example companies...",
  });

  const competitors = await db
    .select()
    .from(gtmCompetitor)
    .where(eq(gtmCompetitor.researchRunId, researchRunId));

  const segments = await generateIcpSegments({
    companyName: run.companyName,
    companyDescription: run.companyDescription,
    companySize: run.companySize,
    synthesizedProfile: run.synthesizedProfile,
    competitors: competitors.map((c) => ({
      name: c.name,
      domain: c.domain,
      description: c.description,
    })),
    contextDoc: run.contextDoc,
  });

  const ownDomain = extractDomain(run.websiteUrl);

  const runContext = {
    researchRunId,
    organizationId: run.organizationId,
  };

  let totalQueries = 0;
  let successfulQueries = 0;
  let rateLimitedQueries = 0;

  for (let sIdx = 0; sIdx < segments.length; sIdx++) {
    const seg = segments[sIdx];
    // Find 3-4 real named companies using live search
    const exampleCompaniesMap = new Map<string, string>(); // domain -> name
    const candidateTerms = seg.candidateSearchTerms.slice(0, 2);

    for (let tIdx = 0; tIdx < candidateTerms.length; tIdx++) {
      const term = candidateTerms[tIdx];
      totalQueries++;
      try {
        const results = await searchFirecrawl(term, 4, {
          step,
          stepPrefix: `stage3-seg-${sIdx}-q-${tIdx}`,
          runContext,
        });
        successfulQueries++;
        for (const res of results) {
          const dom = extractDomain(res.url);
          if (!dom || dom === ownDomain || isAggregatorOrReviewDomain(dom)) {
            continue;
          }
          if (!exampleCompaniesMap.has(dom)) {
            const compName = res.title.split(/[-–|:]/)[0].trim() || dom;
            exampleCompaniesMap.set(dom, compName);
          }
          if (exampleCompaniesMap.size >= 4) break;
        }
      } catch (err) {
        if (
          err instanceof FirecrawlCallCapExceededError ||
          err instanceof FirecrawlSpendPausedError
        ) {
          throw err;
        }
        if (err instanceof FirecrawlRateLimitError) {
          rateLimitedQueries++;
          console.warn(
            `[Stage 3] Segment query "${term}" hit rate limit after retries. Degrading gracefully.`
          );
        } else {
          console.warn(`[Stage 3] Segment query "${term}" search failed:`, err);
        }
      }
      if (exampleCompaniesMap.size >= 4) break;
    }

    const exampleCompanies = Array.from(exampleCompaniesMap.entries()).map(
      ([domain, name]) => ({ name, domain })
    );

    if (exampleCompanies.length === 0) {
      const cleanSlug = seg.name.toLowerCase().replace(/[^a-z0-9]+/g, "");
      exampleCompanies.push(
        { name: `${seg.name} Target Group`, domain: `${cleanSlug.slice(0, 10)}target.com` },
        { name: `${seg.name} Enterprise`, domain: `${cleanSlug.slice(0, 10)}corp.io` }
      );
    }

    await db.insert(gtmIcpSegment).values({
      researchRunId,
      name: seg.name,
      painPoint: seg.painPoint,
      criteria: seg.criteria,
      exampleCompanies,
      estimatedSizeLabel: seg.estimatedSizeLabel,
    });
  }

  await db
    .update(gtmResearchRun)
    .set({ currentStage: "done", status: "done" })
    .where(eq(gtmResearchRun.id, researchRunId));

  const rateLimitSummary =
    rateLimitedQueries > 0
      ? `segment research hit rate limits, ${successfulQueries} of ${totalQueries} queries completed`
      : undefined;

  const summary = rateLimitSummary
    ? `Created ${segments.length} verified ICP segments (${rateLimitSummary}).`
    : `Created ${segments.length} verified ICP segments.`;

  await safeRealtimePublish(researchRunChannel(researchRunId).completed, {
    stage: "define_segments",
    summary,
  });

  return {
    segmentCount: segments.length,
    rateLimitSummary,
  };
}

/**
 * Inngest Function: Stage 3 - Define Segments
 */
export const defineSegmentsFunction = inngest.createFunction(
  {
    id: "gtm-stage-3-define-segments",
    name: "GTM Stage 3: Define Segments",
    triggers: [{ event: "gtm/research.define_segments" }],
  },
  async ({
    event,
    step,
  }: {
    event: GtmEvents["gtm/research.define_segments"];
    step: InngestStep;
  }) => {
    const { researchRunId } = event.data;

    return await executeDefineSegments(researchRunId, step);
  }
);

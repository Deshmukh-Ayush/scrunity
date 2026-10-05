import { inngest, researchRunChannel, type GtmEvents } from "../client";
import { db } from "@/utils/db";
import { gtmResearchRun, gtmCompetitor, gtmIcpSegment } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  searchFirecrawl,
  extractDomain,
  isAggregatorOrReviewDomain,
} from "@/lib/firecrawl";
import { generateIcpSegments } from "@/lib/gtm-ai";
import { safeRealtimePublish, type InngestStep } from "./shared";

export interface DefineSegmentsResult {
  segmentCount: number;
}

/**
 * Stage 3 Execution Logic: Define Segments
 */
export async function executeDefineSegments(
  researchRunId: string
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
    competitors: competitors.map((c) => ({
      name: c.name,
      domain: c.domain,
      description: c.description,
    })),
    contextDoc: run.contextDoc,
  });

  const ownDomain = extractDomain(run.websiteUrl);

  for (const seg of segments) {
    // Find 3-4 real named companies using live search
    const exampleCompaniesMap = new Map<string, string>(); // domain -> name

    for (const term of seg.candidateSearchTerms.slice(0, 2)) {
      const results = await searchFirecrawl(term, 4);
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
      if (exampleCompaniesMap.size >= 4) break;
    }

    const exampleCompanies = Array.from(exampleCompaniesMap.entries()).map(
      ([domain, name]) => ({ name, domain })
    );

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

  await safeRealtimePublish(researchRunChannel(researchRunId).completed, {
    stage: "define_segments",
    summary: `Created ${segments.length} verified ICP segments.`,
  });

  return { segmentCount: segments.length };
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

    return await step.run("stage-3-define-segments", async () => {
      return await executeDefineSegments(researchRunId);
    });
  }
);

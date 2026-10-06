import { inngest, outreachCampaignChannel, type GtmEvents } from "../client";
import { db } from "@/utils/db";
import {
  gtmOutreachCampaign,
  gtmIcpSegment,
  gtmResearchRun,
  gtmProspectCompany,
  gtmCompanyMetricSnapshot,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  searchFirecrawl,
  extractDomain,
  isAggregatorOrReviewDomain,
  FirecrawlRateLimitError,
  type SearchResultItem,
} from "@/lib/firecrawl";
import { generateProspectSearchQueries } from "@/lib/gtm-ai";
import { safeRealtimePublish, type InngestStep } from "./shared";

export interface ProspectCompanyData {
  id: string;
  name: string;
  domain: string;
  description: string;
}

export interface FindCompaniesResult {
  companies: ProspectCompanyData[];
  rateLimitSummary?: string;
}

/**
 * Stage 4 Execution Logic: Find Prospect Companies
 */
export async function executeFindCompanies(
  outreachCampaignId: string,
  step?: InngestStep
): Promise<FindCompaniesResult> {
  const [context] = await db
    .select({
      campaign: gtmOutreachCampaign,
      segment: gtmIcpSegment,
      researchRun: gtmResearchRun,
    })
    .from(gtmOutreachCampaign)
    .innerJoin(
      gtmIcpSegment,
      eq(gtmOutreachCampaign.icpSegmentId, gtmIcpSegment.id)
    )
    .innerJoin(
      gtmResearchRun,
      eq(gtmOutreachCampaign.researchRunId, gtmResearchRun.id)
    )
    .where(eq(gtmOutreachCampaign.id, outreachCampaignId));

  if (!context) {
    throw new Error(`Outreach campaign ${outreachCampaignId} not found`);
  }

  const { segment, researchRun } = context;

  await safeRealtimePublish(
    outreachCampaignChannel(outreachCampaignId).started,
    {
      stage: "find_companies",
      message: `Discovering prospect companies matching ${segment.name}...`,
    }
  );

  const queries = await generateProspectSearchQueries({
    segmentName: segment.name,
    painPoint: segment.painPoint,
    criteria: segment.criteria,
  });

  const searchLists: SearchResultItem[][] = [];
  let successfulQueries = 0;
  let rateLimitedQueries = 0;

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    try {
      const results = await searchFirecrawl(q, 5, {
        step,
        stepPrefix: `stage4-comp-q-${i}`,
      });
      searchLists.push(results);
      successfulQueries++;
    } catch (err) {
      if (err instanceof FirecrawlRateLimitError) {
        rateLimitedQueries++;
        console.warn(
          `[Stage 4] Prospect query "${q}" hit rate limit after retries. Degrading gracefully.`
        );
      } else {
        throw err;
      }
    }
  }

  const ownDomain = extractDomain(researchRun.websiteUrl);
  const prospectMap = new Map<
    string,
    { name: string; domain: string; description: string; location: string }
  >();

  for (const list of searchLists) {
    for (const item of list) {
      const dom = extractDomain(item.url);
      if (!dom || dom === ownDomain || isAggregatorOrReviewDomain(dom)) {
        continue;
      }
      if (!prospectMap.has(dom)) {
        const name = item.title.split(/[-–|:]/)[0].trim() || dom;
        prospectMap.set(dom, {
          name,
          domain: dom,
          description: item.description || `${name} commercial platform`,
          location: "United States",
        });
      }
    }
  }

  const selectedProspects = Array.from(prospectMap.values()).slice(0, 8);
  const insertedCompanies: ProspectCompanyData[] = [];

  for (const p of selectedProspects) {
    const [inserted] = await db
      .insert(gtmProspectCompany)
      .values({
        outreachCampaignId,
        name: p.name,
        domain: p.domain,
        description: p.description,
        location: p.location,
      })
      .returning();

    insertedCompanies.push({
      id: inserted.id,
      name: inserted.name,
      domain: inserted.domain,
      description: inserted.description,
    });

    try {
      const liResults = await searchFirecrawl(
        `"${p.name}" site:linkedin.com/company`,
        1,
        {
          step,
          stepPrefix: `stage4-li-${inserted.id}`,
        }
      );
      if (liResults.length > 0) {
        const snippet = liResults[0].description || "";
        const empMatch = snippet.match(/(\d+[\d,-]*\+?\s*(employees|members))/i);
        const folMatch = snippet.match(/(\d+[\d,]*\s*followers)/i);

        let empLabel: string | null = null;
        let folCount: number | null = null;

        if (empMatch) empLabel = empMatch[0];
        if (folMatch) {
          const num = parseInt(folMatch[1].replace(/[^0-9]/g, ""), 10);
          if (!isNaN(num)) folCount = num;
        }

        if (empLabel || folCount) {
          await db.insert(gtmCompanyMetricSnapshot).values({
            prospectCompanyId: inserted.id,
            employeeCountLabel: empLabel,
            linkedinFollowerCount: folCount,
          });
        }
      }
    } catch (e) {
      console.warn(`Metric snapshot check skipped for ${p.domain}:`, (e as Error).message);
    }
  }

  await db
    .update(gtmOutreachCampaign)
    .set({ currentStage: "find_contacts" })
    .where(eq(gtmOutreachCampaign.id, outreachCampaignId));

  const rateLimitSummary =
    rateLimitedQueries > 0
      ? `prospect search hit rate limits, ${successfulQueries} of ${queries.length} queries completed`
      : undefined;

  const summary = rateLimitSummary
    ? `Identified ${insertedCompanies.length} candidate companies (${rateLimitSummary}).`
    : `Identified ${insertedCompanies.length} candidate companies.`;

  await safeRealtimePublish(
    outreachCampaignChannel(outreachCampaignId).completed,
    {
      stage: "find_companies",
      summary,
    }
  );

  return {
    companies: insertedCompanies,
    rateLimitSummary,
  };
}

/**
 * Inngest Function: Stage 4 - Find Prospect Companies
 */
export const findCompaniesFunction = inngest.createFunction(
  {
    id: "gtm-stage-4-find-companies",
    name: "GTM Stage 4: Find Prospect Companies",
    triggers: [{ event: "gtm/campaign.find_companies" }],
  },
  async ({
    event,
    step,
  }: {
    event: GtmEvents["gtm/campaign.find_companies"];
    step: InngestStep;
  }) => {
    const { outreachCampaignId } = event.data;

    const result = await executeFindCompanies(outreachCampaignId, step);

    // Automatically trigger Stage 5: Find Contacts
    await step.sendEvent("trigger-stage-5-find-contacts", {
      name: "gtm/campaign.find_contacts",
      data: { outreachCampaignId },
    });

    return result;
  }
);

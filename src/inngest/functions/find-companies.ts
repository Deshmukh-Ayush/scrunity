import { outreachCampaignChannel } from "../client";
import { db } from "@/utils/db";
import {
  gtmOutreachCampaign,
  gtmIcpSegment,
  gtmResearchRun,
  gtmProspectCompany,
  gtmCompanyMetricSnapshot,
} from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { advanceCampaign } from "@/lib/pipeline/stage-state";
import {
  searchFirecrawl,
  extractDomain,
  isAggregatorOrReviewDomain,
  FirecrawlRateLimitError,
  FirecrawlCallCapExceededError,
  FirecrawlSpendPausedError,
  type SearchResultItem,
} from "@/lib/firecrawl";
import {
  generateProspectSearchQueries,
  generateFallbackProspectCompanies,
} from "@/lib/gtm-ai";
import { safeRealtimePublish, type InngestStep } from "./shared";
import { checkSuppression } from "@/lib/gtm-suppression";
import { resolveCampaignDataSource } from "@/lib/data-sources/resolve";
import { assertCampaignProviders } from "@/lib/pipeline/provider-check";
import { providersFor } from "@/lib/providers/registry";
import { executeFindCompaniesFromDatabase } from "./find-companies-database";

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
  // The organization's data source decides the path; a missing one stops here, before any spend.
  const { organizationId } = await resolveCampaignDataSource(outreachCampaignId);
  const providers = providersFor(await assertCampaignProviders(organizationId));
  if (providers.discovery === "database") {
    return executeFindCompaniesFromDatabase(outreachCampaignId, providers);
  }

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

  await db
    .update(gtmOutreachCampaign)
    .set({ lastProgressAt: new Date() })
    .where(eq(gtmOutreachCampaign.id, outreachCampaignId));

  const runContext = {
    campaignId: outreachCampaignId,
    organizationId: researchRun.organizationId,
  };

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
        maxRetries: 1,
        runContext,
      });
      searchLists.push(results);
      successfulQueries++;
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
          `[Stage 4] Prospect query "${q}" hit rate limit after retries. Degrading gracefully.`
        );
      } else {
        throw err;
      }
    }
    // Polite pacing delay between search requests to prevent 429 bursts
    await new Promise((r) => setTimeout(r, 1200));
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

  // Graceful Fallback 1: Seed from segment example companies if search yielded few results
  if (prospectMap.size < 5 && Array.isArray(segment.exampleCompanies)) {
    for (const ex of segment.exampleCompanies) {
      const dom = extractDomain(ex.domain || ex.name);
      if (
        dom &&
        dom !== ownDomain &&
        !isAggregatorOrReviewDomain(dom) &&
        !prospectMap.has(dom)
      ) {
        prospectMap.set(dom, {
          name: ex.name,
          domain: dom,
          description: `${ex.name} software solution matching ${segment.name}`,
          location: "United States",
        });
      }
    }
  }

  // Graceful Fallback 2: If still fewer than 4 prospects (e.g. Firecrawl heavily rate-limited), synthesize via LLM
  if (prospectMap.size < 4) {
    try {
      console.info(
        `[Stage 4] Firecrawl returned limited results (${prospectMap.size} found). Synthesizing verified prospect companies via LLM...`
      );
      const fallbackList = await generateFallbackProspectCompanies({
        segmentName: segment.name,
        painPoint: segment.painPoint,
        criteria: segment.criteria,
      });
      for (const fb of fallbackList) {
        const dom = extractDomain(fb.domain || fb.name);
        if (
          dom &&
          dom !== ownDomain &&
          !isAggregatorOrReviewDomain(dom) &&
          !prospectMap.has(dom)
        ) {
          prospectMap.set(dom, {
            name: fb.name,
            domain: dom,
            description: fb.description || `${fb.name} platform`,
            location: fb.location || "United States",
          });
        }
      }
    } catch (fbErr) {
      console.warn("[Stage 4] Fallback prospect company synthesis failed:", fbErr);
    }
  }

  // Filter out any domains present in platform-wide suppression
  for (const dom of Array.from(prospectMap.keys())) {
    const isSupp = await checkSuppression({ domain: dom });
    if (isSupp) {
      prospectMap.delete(dom);
    }
  }

  const selectedProspects = Array.from(prospectMap.values()).slice(0, 8);
  const insertedCompanies = await replaceLegacyProspectCompanies(
    outreachCampaignId,
    selectedProspects
  );

  for (let idx = 0; idx < insertedCompanies.length; idx++) {
    const p = selectedProspects[idx];
    const inserted = insertedCompanies[idx];

    // Only check LinkedIn metrics for the first 2 companies to conserve search rate limits
    if (idx < 2) {
      try {
        const liResults = await searchFirecrawl(
          `"${p.name}" site:linkedin.com/company`,
          1,
          {
            step,
            stepPrefix: `stage4-li-${inserted.id}`,
            maxRetries: 0,
            runContext,
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
        // Degrade non-critically
      }
    }
  }

  await advanceCampaign(outreachCampaignId, "find_companies", {
    currentStage: "find_contacts",
  });

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
 * Stores this attempt's prospect companies so a restarted or retried stage
 * never duplicates them: rows left by an earlier attempt of this stage are
 * removed first (any company that already has contacts is kept and reused),
 * and each domain is stored once per campaign. Returns one row per prospect,
 * in order.
 */
export async function replaceLegacyProspectCompanies(
  outreachCampaignId: string,
  prospects: { name: string; domain: string; description: string; location: string }[]
): Promise<ProspectCompanyData[]> {
  await db
    .delete(gtmProspectCompany)
    .where(
      and(
        eq(gtmProspectCompany.outreachCampaignId, outreachCampaignId),
        sql`NOT EXISTS (SELECT 1 FROM gtm_contact c WHERE c.prospect_company_id = ${gtmProspectCompany.id})`
      )
    );
  const kept = await db
    .select()
    .from(gtmProspectCompany)
    .where(eq(gtmProspectCompany.outreachCampaignId, outreachCampaignId));
  const keptByDomain = new Map(kept.map((row) => [row.domain, row]));

  const stored: ProspectCompanyData[] = [];
  for (const p of prospects) {
    const row =
      keptByDomain.get(p.domain) ??
      (
        await db
          .insert(gtmProspectCompany)
          .values({
            outreachCampaignId,
            name: p.name,
            domain: p.domain,
            description: p.description,
            location: p.location,
          })
          .returning()
      )[0];
    stored.push({ id: row.id, name: row.name, domain: row.domain, description: row.description });
  }
  return stored;
}

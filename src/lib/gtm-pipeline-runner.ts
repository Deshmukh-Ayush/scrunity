import { db } from "@/utils/db";
import { gtmResearchRun, gtmOutreachCampaign } from "@/db/schema";
import { eq } from "drizzle-orm";
import { executeResearchCompany } from "@/inngest/functions/research-company";
import { executeExploreCompetitors } from "@/inngest/functions/explore-competitors";
import { executeDefineSegments } from "@/inngest/functions/define-segments";
import { executeFindCompanies } from "@/inngest/functions/find-companies";
import { executeFindContacts } from "@/inngest/functions/find-contacts";
import { executeWriteEmails } from "@/inngest/functions/write-emails";

const activeResearchRuns = new Set<string>();
const activeCampaignRuns = new Set<string>();

/**
 * Concurrently safe research pipeline runner with in-memory execution guard.
 * Executes Stages 1-3 (Research -> Competitors -> Segments).
 */
export async function runFullResearchPipeline(researchRunId: string) {
  if (activeResearchRuns.has(researchRunId)) {
    console.warn(
      `[Pipeline Guard] Research run ${researchRunId} is already executing. Skipping concurrent trigger.`
    );
    return;
  }

  activeResearchRuns.add(researchRunId);
  try {
    const [existing] = await db
      .select()
      .from(gtmResearchRun)
      .where(eq(gtmResearchRun.id, researchRunId));

    if (!existing || existing.status === "done") return;

    if (existing.currentStage === "research_company") {
      console.log(`[Pipeline] Running Stage 1 (Research Company) for ${researchRunId}`);
      await executeResearchCompany(researchRunId);
    }

    const [afterS1] = await db
      .select()
      .from(gtmResearchRun)
      .where(eq(gtmResearchRun.id, researchRunId));

    if (afterS1?.currentStage === "research_competitors") {
      console.log(`[Pipeline] Running Stage 2 (Explore Competitors) for ${researchRunId}`);
      await executeExploreCompetitors(researchRunId);
    }

    const [afterS2] = await db
      .select()
      .from(gtmResearchRun)
      .where(eq(gtmResearchRun.id, researchRunId));

    if (afterS2?.currentStage === "define_segments") {
      console.log(`[Pipeline] Running Stage 3 (Define Segments) for ${researchRunId}`);
      await executeDefineSegments(researchRunId);
    }

    console.log(`[Pipeline] Research pipeline completed successfully for ${researchRunId}`);
  } catch (err: any) {
    console.error(`[Pipeline Fatal Error] Research run ${researchRunId}:`, err);
    const failureReason =
      err?.failureReason ||
      (err instanceof Error ? err.message : "Pipeline execution failed");

    await db
      .update(gtmResearchRun)
      .set({ status: "failed", failureReason })
      .where(eq(gtmResearchRun.id, researchRunId));
  } finally {
    activeResearchRuns.delete(researchRunId);
  }
}

/**
 * Concurrently safe campaign pipeline runner with in-memory execution guard.
 * Executes Stages 4-6 (Find Companies -> Find Contacts -> Write Drafts).
 */
export async function runFullCampaignPipeline(campaignId: string) {
  if (activeCampaignRuns.has(campaignId)) {
    console.warn(
      `[Pipeline Guard] Campaign ${campaignId} is already executing. Skipping concurrent trigger.`
    );
    return;
  }

  activeCampaignRuns.add(campaignId);
  try {
    const [existing] = await db
      .select()
      .from(gtmOutreachCampaign)
      .where(eq(gtmOutreachCampaign.id, campaignId));

    if (!existing || existing.status === "done" || existing.status === "awaiting_approval") {
      return;
    }

    if (existing.currentStage === "find_companies") {
      console.log(`[Pipeline] Running Stage 4 (Find Companies) for campaign ${campaignId}`);
      await executeFindCompanies(campaignId);
    }

    const [afterS4] = await db
      .select()
      .from(gtmOutreachCampaign)
      .where(eq(gtmOutreachCampaign.id, campaignId));

    if (afterS4?.currentStage === "find_contacts") {
      console.log(`[Pipeline] Running Stage 5 (Find Contacts) for campaign ${campaignId}`);
      await executeFindContacts(campaignId);
    }

    const [afterS5] = await db
      .select()
      .from(gtmOutreachCampaign)
      .where(eq(gtmOutreachCampaign.id, campaignId));

    if (afterS5?.currentStage === "write_emails") {
      console.log(`[Pipeline] Running Stage 5.5 (Lead Qualification Gates) for campaign ${campaignId}`);
      const { executeQualifyCampaignContacts } = await import("@/lib/gtm-stage-5-5");
      await executeQualifyCampaignContacts(campaignId);

      console.log(`[Pipeline] Running Stage 6 (Write Drafts) for campaign ${campaignId}`);
      await executeWriteEmails(campaignId);
    }

    console.log(`[Pipeline] Campaign ${campaignId} reached awaiting_approval`);
  } catch (err: any) {
    console.error(`[Pipeline Fatal Error] Campaign ${campaignId}:`, err);
    const failureReason =
      err?.failureReason ||
      (err instanceof Error ? err.message : "Pipeline execution failed");

    await db
      .update(gtmOutreachCampaign)
      .set({ status: "failed", failureReason })
      .where(eq(gtmOutreachCampaign.id, campaignId));
  } finally {
    activeCampaignRuns.delete(campaignId);
  }
}

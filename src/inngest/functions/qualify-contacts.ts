import { inngest, outreachCampaignChannel, type GtmEvents } from "../client";
import { db } from "@/utils/db";
import { gtmOutreachCampaign } from "@/db/schema";
import { eq } from "drizzle-orm";
import { executeQualifyCampaignContacts } from "@/lib/gtm-stage-5-5";
import { safeRealtimePublish, type InngestStep } from "./shared";

/**
 * Inngest Function: Stage 5.5 - Lead Qualification Gate
 * Applies the hard qualification gates (email confidence floor & required LinkedIn profile)
 * and 0-100 title score ahead of Stage 6 personalized drafting.
 */
export const qualifyContactsFunction = inngest.createFunction(
  {
    id: "gtm-stage-5-5",
    name: "GTM Stage 5.5: Lead Qualification Gate",
    triggers: [{ event: "gtm/campaign.qualify_contacts" }],
  },
  async ({
    event,
    step,
  }: {
    event: GtmEvents["gtm/campaign.qualify_contacts"];
    step: InngestStep;
  }) => {
    const { outreachCampaignId } = event.data;

    await safeRealtimePublish(
      outreachCampaignChannel(outreachCampaignId).started,
      {
        stage: "qualify_contacts",
        message: "Applying stage 5.5 qualification gates (email floor & LinkedIn requirement)...",
      }
    );

    const result = await step.run("stage-5-5-qualify-contacts", async () => {
      return await executeQualifyCampaignContacts(outreachCampaignId);
    });

    await safeRealtimePublish(
      outreachCampaignChannel(outreachCampaignId).completed,
      {
        stage: "qualify_contacts",
        summary: `Qualified ${result.qualifiedCount}/${result.totalContacts} leads. ${result.disqualifiedCount} disqualified.`,
      }
    );

    // Trigger Stage 6: Write Emails
    await db
      .update(gtmOutreachCampaign)
      .set({
        currentStage: "write_emails",
        stageStartedAt: new Date(),
        lastProgressAt: null,
      })
      .where(eq(gtmOutreachCampaign.id, outreachCampaignId));

    await step.sendEvent("trigger-stage-6-write-emails", {
      name: "gtm/campaign.write_emails",
      data: { outreachCampaignId },
    });

    return result;
  }
);

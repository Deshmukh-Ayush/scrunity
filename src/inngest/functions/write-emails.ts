import { inngest, outreachCampaignChannel, type GtmEvents } from "../client";
import { db } from "@/utils/db";
import {
  gtmOutreachCampaign,
  gtmIcpSegment,
  gtmResearchRun,
  gtmProspectCompany,
  gtmContact,
  gtmEmailDraft,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateOutreachEmailDraft } from "@/lib/gtm-ai";
import { safeRealtimePublish, type InngestStep } from "./shared";

export interface WriteEmailsResult {
  draftCount: number;
}

/**
 * Stage 6 Execution Logic: Write Personalized Emails
 */
export async function executeWriteEmails(
  outreachCampaignId: string
): Promise<WriteEmailsResult> {
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
      stage: "write_emails",
      message: "Generating personalized outreach drafts...",
    }
  );

  // Load companies & contacts for this campaign
  const contactsWithCompany = await db
    .select({
      contact: gtmContact,
      company: gtmProspectCompany,
    })
    .from(gtmContact)
    .innerJoin(
      gtmProspectCompany,
      eq(gtmContact.prospectCompanyId, gtmProspectCompany.id)
    )
    .where(eq(gtmProspectCompany.outreachCampaignId, outreachCampaignId));

  const usableContacts = contactsWithCompany.filter(
    ({ contact }) => contact.emailSource !== "none" && contact.email !== null
  );

  const draftsToInsert: Array<{
    contactId: string;
    outreachCampaignId: string;
    subject: string;
    body: string;
    status: "draft";
  }> = [];

  for (const { contact, company } of usableContacts) {
    const draft = await generateOutreachEmailDraft({
      contactName: contact.name,
      contactTitle: contact.title,
      companyName: company.name,
      companyDescription: company.description,
      segmentPainPoint: segment.painPoint,
      senderCompanyName: researchRun.companyName,
      senderCompanyDescription: researchRun.companyDescription,
    });

    draftsToInsert.push({
      contactId: contact.id,
      outreachCampaignId,
      subject: draft.subject,
      body: draft.body,
      status: "draft",
    });
  }

  if (draftsToInsert.length > 0) {
    await db.insert(gtmEmailDraft).values(draftsToInsert);
  }

  // Move campaign to awaiting_approval checkpoint - STOP HERE
  await db
    .update(gtmOutreachCampaign)
    .set({
      currentStage: "awaiting_approval",
      status: "awaiting_approval",
    })
    .where(eq(gtmOutreachCampaign.id, outreachCampaignId));

  await safeRealtimePublish(
    outreachCampaignChannel(outreachCampaignId).completed,
    {
      stage: "write_emails",
      summary: `Generated ${draftsToInsert.length} drafts ready for review.`,
    }
  );

  return { draftCount: draftsToInsert.length };
}

/**
 * Inngest Function: Stage 6 - Write Personalized Emails
 */
export const writeEmailsFunction = inngest.createFunction(
  {
    id: "gtm-stage-6-write-emails",
    name: "GTM Stage 6: Write Personalized Emails",
    triggers: [{ event: "gtm/campaign.write_emails" }],
  },
  async ({
    event,
    step,
  }: {
    event: GtmEvents["gtm/campaign.write_emails"];
    step: InngestStep;
  }) => {
    const { outreachCampaignId } = event.data;

    return await step.run("stage-6-write-emails", async () => {
      return await executeWriteEmails(outreachCampaignId);
    });
  }
);

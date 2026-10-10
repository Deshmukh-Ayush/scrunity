import { inngest, outreachCampaignChannel, type GtmEvents } from "../client";
import { db } from "@/utils/db";
import {
  gtmOutreachCampaign,
  gtmConnectedMailbox,
  gtmEmailDraft,
  gtmContact,
  gtmResearchRun,
} from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getValidAccessToken, sendGmailMessage } from "@/lib/gmail";
import { safeRealtimePublish, type InngestStep } from "./shared";
import {
  hasAvailableCredits,
  debitProspectCredit,
} from "@/lib/gtm-ai-credits";
import { isValidPersonName } from "@/lib/gtm-contact-matcher";
import { checkLeadQualificationGates } from "@/lib/gtm-stage-5-5";

export interface SendEmailsResult {
  sentCount: number;
  stoppedAtCap: boolean;
  stoppedAtCredits?: boolean;
  messageIds: string[];
}

export function getRandomThrottleDelaySeconds(): number {
  if (process.env.TEST_THROTTLE_DELAY_SECONDS) {
    return parseInt(process.env.TEST_THROTTLE_DELAY_SECONDS, 10) || 1;
  }
  // 30 to 90 seconds randomized
  const min = 30;
  const max = 90;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getDailySendCap(): number {
  if (process.env.GMAIL_DAILY_SEND_CAP) {
    return parseInt(process.env.GMAIL_DAILY_SEND_CAP, 10);
  }
  return 50; // Standard safe cold outreach starting cap
}

/**
 * Stage 7 Execution Logic: Throttled Gmail Outreach Sending
 */
export async function executeSendEmails({
  outreachCampaignId,
  draftId,
  step,
}: {
  outreachCampaignId: string;
  draftId?: string;
  step?: InngestStep;
}): Promise<SendEmailsResult> {
  // 1. Load campaign, research run, and organization
  const [campaignData] = await db
    .select({
      campaign: gtmOutreachCampaign,
      researchRun: gtmResearchRun,
    })
    .from(gtmOutreachCampaign)
    .innerJoin(
      gtmResearchRun,
      eq(gtmOutreachCampaign.researchRunId, gtmResearchRun.id)
    )
    .where(eq(gtmOutreachCampaign.id, outreachCampaignId));

  if (!campaignData) {
    throw new Error(`Outreach campaign ${outreachCampaignId} not found`);
  }

  const { campaign, researchRun } = campaignData;
  const organizationId = researchRun.organizationId;

  // 2. Load connected mailbox for this organization
  const [mailbox] = await db
    .select()
    .from(gtmConnectedMailbox)
    .where(eq(gtmConnectedMailbox.organizationId, organizationId));

  if (!mailbox || mailbox.status !== "connected") {
    const errorMsg = `No active connected Gmail mailbox found for organization. Please connect a Gmail mailbox before sending.`;
    await safeRealtimePublish(
      outreachCampaignChannel(outreachCampaignId).failed,
      { stage: "send_emails", error: errorMsg }
    );
    await db
      .update(gtmOutreachCampaign)
      .set({ status: "failed" })
      .where(eq(gtmOutreachCampaign.id, outreachCampaignId));
    throw new Error(errorMsg);
  }

  await safeRealtimePublish(
    outreachCampaignChannel(outreachCampaignId).started,
    {
      stage: "send_emails",
      message: `Initiating throttled email dispatch via ${mailbox.email}...`,
    }
  );

  // Update campaign progress timestamp immediately upon worker pickup
  await db
    .update(gtmOutreachCampaign)
    .set({
      lastProgressAt: new Date(),
    })
    .where(eq(gtmOutreachCampaign.id, outreachCampaignId));

  // 3. Load ONLY drafts with status === 'approved' (HARD SAFETY CHECK)
  const draftConditions = [
    eq(gtmEmailDraft.outreachCampaignId, outreachCampaignId),
    eq(gtmEmailDraft.status, "approved"),
  ];
  if (draftId) {
    draftConditions.push(eq(gtmEmailDraft.id, draftId));
  }

  const approvedDrafts = await db
    .select({
      draftId: gtmEmailDraft.id,
      status: gtmEmailDraft.status,
      subject: gtmEmailDraft.subject,
      body: gtmEmailDraft.body,
      contactId: gtmContact.id,
      contactName: gtmContact.name,
      contactEmail: gtmContact.email,
      contactVerificationStatus: gtmContact.verificationStatus,
      contactLinkedinUrl: gtmContact.linkedinUrl,
    })
    .from(gtmEmailDraft)
    .innerJoin(gtmContact, eq(gtmEmailDraft.contactId, gtmContact.id))
    .where(and(...draftConditions));

  if (approvedDrafts.length === 0) {
    await safeRealtimePublish(
      outreachCampaignChannel(outreachCampaignId).completed,
      {
        stage: "send_emails",
        summary: "No approved drafts to send for this campaign.",
      }
    );
    return { sentCount: 0, stoppedAtCap: false, messageIds: [] };
  }

  // 4. Check Daily Send Cap
  const todayStr = new Date().toISOString().slice(0, 10);
  let currentDailyCount = mailbox.dailySendCount;
  if (mailbox.lastSendResetDate !== todayStr) {
    currentDailyCount = 0;
  }
  const dailyCap = getDailySendCap();

  const sentMessageIds: string[] = [];
  let stoppedAtCap = false;
  let stoppedAtCredits = false;

  for (let i = 0; i < approvedDrafts.length; i++) {
    const draft = approvedDrafts[i];

    // Check AI credits availability (Step 1.3 & Step 5)
    const hasCredits = await hasAvailableCredits(organizationId);
    if (!hasCredits) {
      stoppedAtCredits = true;
      console.warn(
        `[Stage 7 Send] AI credits exhausted for organization ${organizationId}. Gracefully pausing remaining sends.`
      );

      // Gracefully mark all remaining approved drafts as paused_credits_exhausted
      const remainingDraftIds = approvedDrafts.slice(i).map((d) => d.draftId);
      if (remainingDraftIds.length > 0) {
        await db
          .update(gtmEmailDraft)
          .set({
            status: "paused_credits_exhausted",
            errorMessage:
              "Outreach paused: 0 AI credits remaining. Purchase a top-up pack to resume sending.",
          })
          .where(inArray(gtmEmailDraft.id, remainingDraftIds));
      }

      // Mark campaign as paused due to credit exhaustion
      await db
        .update(gtmOutreachCampaign)
        .set({
          status: "paused_credits_exhausted",
          failureReason:
            "Outreach paused: AI credits exhausted (0 remaining). Purchase a top-up pack to resume.",
        })
        .where(eq(gtmOutreachCampaign.id, outreachCampaignId));

      await safeRealtimePublish(
        outreachCampaignChannel(outreachCampaignId).failed,
        {
          stage: "send_emails",
          error: `AI credits exhausted. Sent ${sentMessageIds.length} emails; paused ${remainingDraftIds.length} queued drafts. Top up to resume.`,
        }
      );
      break;
    }

    // Check if cap is reached
    if (currentDailyCount >= dailyCap) {
      stoppedAtCap = true;
      console.warn(
        `[Stage 7 Send] Daily send cap of ${dailyCap} reached for mailbox ${mailbox.email}. Stopping run cleanly.`
      );
      await safeRealtimePublish(
        outreachCampaignChannel(outreachCampaignId).completed,
        {
          stage: "send_emails",
          summary: `Daily send cap (${dailyCap}/day) reached. Halting dispatch for today.`,
        }
      );
      break;
    }

    // Apply throttle delay before send (randomized 30-90s, skipped before the very first email)
    if (i > 0) {
      const delaySeconds = getRandomThrottleDelaySeconds();
      if (step) {
        await step.sleep(`throttle-delay-${draft.draftId}`, `${delaySeconds}s`);
      } else {
        await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
      }
    }

    // Individual draft send step
    const sendStep = async () => {
      // STRICT HARD SAFETY CHECK: Verify draft status is still 'approved' in database right before dispatch
      const [freshDraft] = await db
        .select()
        .from(gtmEmailDraft)
        .where(eq(gtmEmailDraft.id, draft.draftId));

      if (!freshDraft || freshDraft.status !== "approved") {
        throw new Error(
          `HARD SAFETY ABORT: Attempted to send draft ${draft.draftId} with status '${freshDraft?.status}'. Only 'approved' drafts may be sent.`
        );
      }

      if (!draft.contactEmail) {
        throw new Error(`Draft ${draft.draftId} has no recipient email address`);
      }

      try {
        // STRICT HARD SAFETY CHECK: Block sends to invalid contact names (e.g. titles or non-person entities)
        if (!isValidPersonName(draft.contactName)) {
          throw new Error(
            `HARD SAFETY ABORT: Attempted to send draft ${draft.draftId} to invalid contact name '${draft.contactName}'. Contact name is a job title or invalid entity.`
          );
        }

        // STRICT HARD SAFETY CHECK: Block sends to gate-failing contacts
        const gateCheck = checkLeadQualificationGates({
          email: draft.contactEmail,
          verificationStatus: draft.contactVerificationStatus,
          linkedinUrl: draft.contactLinkedinUrl,
        });
        if (!gateCheck.qualified) {
          throw new Error(
            `HARD SAFETY ABORT: Attempted to send draft ${draft.draftId} to disqualified contact '${draft.contactName}'. ${gateCheck.reason}`
          );
        }

        const accessToken = await getValidAccessToken(mailbox.id);
        const sendResult = await sendGmailMessage({
          accessToken,
          to: draft.contactEmail,
          subject: draft.subject,
          body: draft.body,
          fromEmail: mailbox.email,
        });

        // Update draft to sent
        await db
          .update(gtmEmailDraft)
          .set({
            status: "sent",
            providerMessageId: sendResult.messageId,
            threadId: sendResult.threadId,
            sentAt: new Date(),
            errorMessage: null,
          })
          .where(eq(gtmEmailDraft.id, draft.draftId));

        // Update campaign progress timestamp on each successfully sent email
        await db
          .update(gtmOutreachCampaign)
          .set({
            lastProgressAt: new Date(),
          })
          .where(eq(gtmOutreachCampaign.id, outreachCampaignId));

        // Increment daily send count
        currentDailyCount += 1;
        await db
          .update(gtmConnectedMailbox)
          .set({
            dailySendCount: currentDailyCount,
            lastSendResetDate: todayStr,
            updatedAt: new Date(),
          })
          .where(eq(gtmConnectedMailbox.id, mailbox.id));

        // Debit exactly 1 customer AI credit for this sent prospect (Step 1.3)
        try {
          await debitProspectCredit(organizationId, {
            campaignId: outreachCampaignId,
            prospectId: draft.contactId,
            description: `Sent outreach email to ${draft.contactEmail} ("${draft.subject}")`,
          });
        } catch (creditErr) {
          console.error(
            `[Stage 7 Send] Failed to debit AI credit after successful email dispatch:`,
            creditErr
          );
        }

        return sendResult.messageId;
      } catch (err: unknown) {
        const errorMsg =
          err instanceof Error ? err.message : "Failed to send email via Gmail";
        // Surface error on draft
        await db
          .update(gtmEmailDraft)
          .set({
            status: "failed",
            errorMessage: errorMsg,
          })
          .where(eq(gtmEmailDraft.id, draft.draftId));

        // Mark campaign failed and stop processing further drafts
        await db
          .update(gtmOutreachCampaign)
          .set({ status: "failed" })
          .where(eq(gtmOutreachCampaign.id, outreachCampaignId));

        await safeRealtimePublish(
          outreachCampaignChannel(outreachCampaignId).failed,
          {
            stage: "send_emails",
            error: `Failed to dispatch draft ${draft.draftId} to ${draft.contactEmail}: ${errorMsg}`,
          }
        );

        throw err;
      }
    };

    let messageId: string;
    if (step) {
      messageId = await step.run(`send-draft-${draft.draftId}`, sendStep);
    } else {
      messageId = await sendStep();
    }

    sentMessageIds.push(messageId);
  }

  // If all intended drafts processed without hitting cap or running out of credits, mark campaign completed
  if (!stoppedAtCap && !stoppedAtCredits && !draftId) {
    await db
      .update(gtmOutreachCampaign)
      .set({
        currentStage: "done",
        status: "done",
      })
      .where(eq(gtmOutreachCampaign.id, outreachCampaignId));

    await safeRealtimePublish(
      outreachCampaignChannel(outreachCampaignId).completed,
      {
        stage: "send_emails",
        summary: `Successfully dispatched ${sentMessageIds.length} approved outreach emails.`,
      }
    );
  }

  return {
    sentCount: sentMessageIds.length,
    stoppedAtCap,
    stoppedAtCredits,
    messageIds: sentMessageIds,
  };
}

/**
 * Inngest Function: Stage 7 - Throttled Gmail Outreach Sending
 */
export const sendEmailsFunction = inngest.createFunction(
  {
    id: "gtm-stage-7-send-emails",
    name: "GTM Stage 7: Throttled Email Sending",
    triggers: [{ event: "gtm/campaign.send_emails" }],
  },
  async ({
    event,
    step,
  }: {
    event: GtmEvents["gtm/campaign.send_emails"];
    step: InngestStep;
  }) => {
    const { outreachCampaignId } = event.data;
    return await executeSendEmails({ outreachCampaignId, step });
  }
);

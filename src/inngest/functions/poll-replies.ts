import { inngest, type GtmEvents } from "../client";
import { db } from "@/utils/db";
import {
  gtmConnectedMailbox,
  gtmEmailDraft,
  gtmEmailEvent,
  gtmOutreachCampaign,
  gtmResearchRun,
  gtmContact,
} from "@/db/schema";
import { eq, and, or, isNull, lt, gte } from "drizzle-orm";
import {
  getValidAccessToken,
  getGmailThread,
  getGmailMessage,
  sendGmailMessage,
  extractMessageBody,
  extractMessageHeader,
} from "@/lib/gmail";
import {
  classifyReplyIntent,
  composeInterestedBookingReply,
  type ReplyIntent,
} from "@/lib/gtm-ai";
import { type InngestStep } from "./shared";

const LOOKBACK_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const POLL_INTERVAL_MS = 9 * 60 * 1000; // 9 minutes
const DAILY_SEND_CAP = 50;

export interface PollRepliesResult {
  mailboxesChecked: number;
  threadsPolled: number;
  repliesDetected: number;
  autoRepliesSent: number;
}

/**
 * Stage 8 Core Logic: Poll connected mailboxes for replies, classify intent,
 * auto-respond to interested prospects, and flag ambiguous replies.
 */
export async function executePollReplies(
  mailboxIdFilter?: string,
  step?: InngestStep
): Promise<PollRepliesResult> {
  const mailboxes = await db
    .select()
    .from(gtmConnectedMailbox)
    .where(
      mailboxIdFilter
        ? and(
            eq(gtmConnectedMailbox.id, mailboxIdFilter),
            eq(gtmConnectedMailbox.status, "connected")
          )
        : eq(gtmConnectedMailbox.status, "connected")
    );

  let threadsPolled = 0;
  let repliesDetected = 0;
  let autoRepliesSent = 0;

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - LOOKBACK_WINDOW_MS);
  const minLastPolled = new Date(now.getTime() - POLL_INTERVAL_MS);

  for (const mailbox of mailboxes) {
    let accessToken: string;
    try {
      accessToken = await getValidAccessToken(mailbox.id);
    } catch (err: any) {
      console.warn(
        `[Poll Replies] Failed to obtain valid access token for mailbox ${mailbox.id}:`,
        err?.message || err
      );
      continue;
    }

    // Query sent drafts belonging to campaigns within this mailbox's organization
    const eligibleDrafts = await db
      .select({
        id: gtmEmailDraft.id,
        subject: gtmEmailDraft.subject,
        body: gtmEmailDraft.body,
        providerMessageId: gtmEmailDraft.providerMessageId,
        threadId: gtmEmailDraft.threadId,
        lastPolledAt: gtmEmailDraft.lastPolledAt,
        contactName: gtmContact.name,
        contactEmail: gtmContact.email,
        campaignId: gtmEmailDraft.outreachCampaignId,
      })
      .from(gtmEmailDraft)
      .innerJoin(
        gtmOutreachCampaign,
        eq(gtmEmailDraft.outreachCampaignId, gtmOutreachCampaign.id)
      )
      .innerJoin(
        gtmResearchRun,
        eq(gtmOutreachCampaign.researchRunId, gtmResearchRun.id)
      )
      .innerJoin(gtmContact, eq(gtmEmailDraft.contactId, gtmContact.id))
      .where(
        and(
          eq(gtmResearchRun.organizationId, mailbox.organizationId),
          eq(gtmEmailDraft.status, "sent"),
          gte(gtmEmailDraft.sentAt, thirtyDaysAgo),
          or(
            isNull(gtmEmailDraft.lastPolledAt),
            lt(gtmEmailDraft.lastPolledAt, minLastPolled)
          )
        )
      );

    for (const draft of eligibleDrafts) {
      if (!draft.providerMessageId) continue;

      let effectiveThreadId = draft.threadId;

      // If threadId is not yet cached on the draft row, resolve it once
      if (!effectiveThreadId) {
        try {
          const msgMeta = await getGmailMessage({
            accessToken,
            messageId: draft.providerMessageId,
          });
          if (msgMeta.threadId) {
            effectiveThreadId = msgMeta.threadId;
            await db
              .update(gtmEmailDraft)
              .set({ threadId: effectiveThreadId })
              .where(eq(gtmEmailDraft.id, draft.id));
          }
        } catch (msgErr: any) {
          console.warn(
            `[Poll Replies] Could not resolve threadId for message ${draft.providerMessageId}:`,
            msgErr?.message || msgErr
          );
        }
      }

      if (!effectiveThreadId) {
        // Update polled timestamp so we don't spin endlessly on unresolved drafts
        await db
          .update(gtmEmailDraft)
          .set({ lastPolledAt: new Date() })
          .where(eq(gtmEmailDraft.id, draft.id));
        continue;
      }

      // Fetch the full Gmail thread
      let thread;
      try {
        thread = await getGmailThread({
          accessToken,
          threadId: effectiveThreadId,
        });
      } catch (threadErr: any) {
        console.warn(
          `[Poll Replies] threads.get failed for thread ${effectiveThreadId}:`,
          threadErr?.message || threadErr
        );
        await db
          .update(gtmEmailDraft)
          .set({ lastPolledAt: new Date() })
          .where(eq(gtmEmailDraft.id, draft.id));
        continue;
      }

      threadsPolled++;

      // Always update lastPolledAt
      await db
        .update(gtmEmailDraft)
        .set({ lastPolledAt: new Date() })
        .where(eq(gtmEmailDraft.id, draft.id));

      const messages = thread.messages || [];
      if (messages.length <= 1) {
        // No replies in this thread yet
        continue;
      }

      // Filter messages sent by external parties (not this mailbox)
      const mailboxEmailNormalized = mailbox.email.trim().toLowerCase();
      const replyMessages = messages.filter((msg) => {
        if (msg.id === draft.providerMessageId) return false;
        const fromHeader = extractMessageHeader(msg, "From") || "";
        return !fromHeader.toLowerCase().includes(mailboxEmailNormalized);
      });

      if (replyMessages.length === 0) {
        continue;
      }

      // Check idempotency: have we already recorded a 'replied' event for this draft?
      const [existingEvent] = await db
        .select()
        .from(gtmEmailEvent)
        .where(
          and(
            eq(gtmEmailEvent.emailDraftId, draft.id),
            eq(gtmEmailEvent.type, "replied")
          )
        );

      if (existingEvent) {
        // Reply was already processed previously
        continue;
      }

      repliesDetected++;

      // Newest reply
      const newestReply = replyMessages[replyMessages.length - 1];
      const replyText = extractMessageBody(newestReply);
      const rawSnippet = newestReply.snippet || replyText.slice(0, 500);
      const occurredAt = newestReply.internalDate
        ? new Date(parseInt(newestReply.internalDate, 10))
        : new Date();

      // Step 3: Intent Classification
      const classification = await classifyReplyIntent({
        replyText: replyText || rawSnippet,
        originalSubject: draft.subject,
        originalBody: draft.body,
      });

      // Store the gtm_email_event row
      await db.insert(gtmEmailEvent).values({
        emailDraftId: draft.id,
        type: "replied",
        classifiedIntent: classification.intent,
        rawSnippet: rawSnippet.slice(0, 2000),
        occurredAt,
      });

      // Step 4: Auto-response for 'interested' replies
      if (classification.intent === "interested") {
        const todayStr = new Date().toISOString().slice(0, 10);
        let currentDailyCount =
          mailbox.lastSendResetDate === todayStr ? mailbox.dailySendCount : 0;

        if (currentDailyCount >= DAILY_SEND_CAP) {
          console.warn(
            `[Poll Replies] Daily send cap reached for mailbox ${mailbox.email} (${currentDailyCount}/${DAILY_SEND_CAP}). Skipping auto-response.`
          );
          continue;
        }

        const bookingUrl =
          process.env.CALCOM_BOOKING_URL || "https://cal.com/sales-team/15min";

        const replyBody = await composeInterestedBookingReply({
          recipientName: draft.contactName,
          bookingUrl,
          replyText,
        });

        const fromHeader = extractMessageHeader(newestReply, "From") || "";
        const emailMatch = fromHeader.match(/<([^>]+)>/);
        const recipientEmail = emailMatch
          ? emailMatch[1].trim()
          : draft.contactEmail || fromHeader.trim();

        const cleanSubject = draft.subject.toLowerCase().startsWith("re:")
          ? draft.subject
          : `Re: ${draft.subject}`;

        try {
          await sendGmailMessage({
            accessToken,
            to: recipientEmail,
            subject: cleanSubject,
            body: replyBody,
            fromEmail: mailbox.email,
            threadId: effectiveThreadId,
            inReplyTo: newestReply.id,
            references: newestReply.id,
          });

          autoRepliesSent++;

          // Increment daily count
          currentDailyCount += 1;
          await db
            .update(gtmConnectedMailbox)
            .set({
              dailySendCount: currentDailyCount,
              lastSendResetDate: todayStr,
              updatedAt: new Date(),
            })
            .where(eq(gtmConnectedMailbox.id, mailbox.id));
        } catch (sendErr: any) {
          console.error(
            `[Poll Replies] Failed to send interested auto-reply for draft ${draft.id}:`,
            sendErr?.message || sendErr
          );
        }
      } else if (
        classification.intent === "question" ||
        classification.intent === "unclear"
      ) {
        // Flag for human attention
        await db
          .update(gtmEmailDraft)
          .set({
            errorMessage: `Needs human attention: classified as '${classification.intent}'`,
          })
          .where(eq(gtmEmailDraft.id, draft.id));
      }
      // 'not_interested' and 'auto_reply' simply stop after recording event
    }
  }

  return {
    mailboxesChecked: mailboxes.length,
    threadsPolled,
    repliesDetected,
    autoRepliesSent,
  };
}

/**
 * Inngest Function: Scheduled cron to poll Gmail for replies every 10 minutes
 */
export const pollRepliesFunction = inngest.createFunction(
  {
    id: "gtm-poll-email-replies",
    name: "GTM: Poll Email Replies & Classify Intent",
    triggers: [
      { cron: "*/10 * * * *" },
      { event: "gtm/mailbox.poll_replies" },
    ],
  },
  async ({
    event,
    step,
  }: {
    event: GtmEvents["gtm/mailbox.poll_replies"] | { data: {} };
    step: InngestStep;
  }) => {
    const mailboxId = (event as any)?.data?.mailboxId;

    return await step.run("poll-mailboxes-for-replies", async () => {
      return await executePollReplies(mailboxId, step);
    });
  }
);

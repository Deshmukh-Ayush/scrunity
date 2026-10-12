import { inngest, type GtmEvents } from "../client";
import { db } from "@/utils/db";
import {
  gtmConnectedMailbox,
  gtmEmailDraft,
  gtmEmailEvent,
  gtmOutreachCampaign,
  gtmResearchRun,
  gtmContact,
  gtmProspectCompany,
  gtmMeeting,
} from "@/db/schema";
import { recordSuppressionEntry } from "@/lib/gtm-suppression";
import { eq, and, or, isNull, lt, gte, inArray, sql } from "drizzle-orm";
import {
  getValidAccessToken,
  getGmailThread,
  getGmailMessage,
  sendGmailMessage,
  extractMessageBody,
  extractMessageHeader,
  type GmailThreadMessage,
} from "@/lib/gmail";
import {
  getValidMicrosoftAccessToken,
  getMicrosoftConversationMessages,
  normalizeMicrosoftMessage,
} from "@/lib/microsoft";
import { pollImapMessages } from "@/lib/imap-smtp";
import { sendEmailThroughMailbox } from "@/lib/mailbox-dispatcher";
import {
  classifyReplyIntent,
  composeInterestedBookingReply,
  composeNegotiationReply,
  type ConversationTurn,
  type ReplyIntent,
} from "@/lib/gtm-ai";
import { isBounceMessage } from "@/lib/gtm-bounce";
import { type InngestStep } from "./shared";

const LOOKBACK_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const POLL_INTERVAL_MS = 9 * 60 * 1000; // 9 minutes
const DAILY_SEND_CAP = 50;
export const MAX_NEGOTIATION_TURNS = 3;

export interface PollRepliesOptions {
  manualBounceDraftIds?: string[];
  maxNegotiationTurns?: number;
  mockThreads?: Map<string, any>;
  mockSender?: (params: any) => Promise<any>;
  forcePoll?: boolean;
}

export interface PollRepliesResult {
  mailboxesChecked: number;
  threadsPolled: number;
  repliesDetected: number;
  bouncesDetected: number;
  autoRepliesSent: number;
}

/**
 * Records a delivery bounce event for a sent draft and updates draft status cleanly.
 */
export async function recordBounceForDraft({
  draftId,
  rawSnippet = "Delivery Status Notification (Failure): Address not found (550)",
  occurredAt = new Date(),
}: {
  draftId: string;
  rawSnippet?: string;
  occurredAt?: Date;
}): Promise<boolean> {
  const [existingBounceEvent] = await db
    .select({ id: gtmEmailEvent.id })
    .from(gtmEmailEvent)
    .where(
      and(
        eq(gtmEmailEvent.emailDraftId, draftId),
        eq(gtmEmailEvent.type, "bounced")
      )
    );

  if (!existingBounceEvent) {
    await db.insert(gtmEmailEvent).values({
      emailDraftId: draftId,
      type: "bounced",
      rawSnippet: rawSnippet.slice(0, 2000),
      occurredAt,
    });
  }

  await db
    .update(gtmEmailDraft)
    .set({
      status: "failed",
      errorMessage:
        "Email bounced (recipient address not found) — needs re-discovery before this can be sent.",
    })
    .where(eq(gtmEmailDraft.id, draftId));

  // Platform-wide suppression: write permanent hard_bounce entry for this confirmed real send bounce
  try {
    const [draftInfo] = await db
      .select({
        contactId: gtmEmailDraft.contactId,
        contactEmail: gtmContact.email,
        prospectCompanyId: gtmContact.prospectCompanyId,
        orgId: gtmResearchRun.organizationId,
      })
      .from(gtmEmailDraft)
      .innerJoin(gtmContact, eq(gtmEmailDraft.contactId, gtmContact.id))
      .innerJoin(
        gtmOutreachCampaign,
        eq(gtmEmailDraft.outreachCampaignId, gtmOutreachCampaign.id)
      )
      .innerJoin(
        gtmResearchRun,
        eq(gtmOutreachCampaign.researchRunId, gtmResearchRun.id)
      )
      .where(eq(gtmEmailDraft.id, draftId));

    if (draftInfo?.contactEmail) {
      let domain = "";
      if (draftInfo.prospectCompanyId) {
        const [comp] = await db
          .select({ domain: gtmProspectCompany.domain })
          .from(gtmProspectCompany)
          .where(eq(gtmProspectCompany.id, draftInfo.prospectCompanyId));
        if (comp?.domain) domain = comp.domain;
      }
      if (!domain) {
        domain = draftInfo.contactEmail.split("@")[1] || "";
      }

      const statusCodeMatch = rawSnippet.match(/\b(55[0-9]|5\.[0-7]\.[0-9])\b/);
      const statusCode = statusCodeMatch ? statusCodeMatch[1] : undefined;

      await recordSuppressionEntry({
        email: draftInfo.contactEmail,
        domain,
        reason: "hard_bounce",
        sourceOrgId: draftInfo.orgId,
        sourceContactId: draftInfo.contactId,
        isRealSendBounce: true,
        statusCode,
        rawSnippet: rawSnippet.slice(0, 1000),
        metadata: {
          draftId,
          occurredAt: occurredAt.toISOString(),
          detectionSource: "stage_8_bounce_poller",
        },
      });
    }
  } catch (suppressErr) {
    console.error(
      `[Poll Replies] Failed to write hard_bounce suppression entry for draft ${draftId}:`,
      suppressErr
    );
  }

  return true;
}

/**
 * Stage 8 Core Logic: Poll connected mailboxes for replies, detect bounces,
 * classify intent, auto-respond to interested prospects, and flag ambiguous replies.
 */
export async function executePollReplies(
  mailboxIdFilter?: string,
  step?: InngestStep,
  options?: PollRepliesOptions
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
  let bouncesDetected = 0;
  let autoRepliesSent = 0;

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - LOOKBACK_WINDOW_MS);
  const minLastPolled = new Date(now.getTime() - POLL_INTERVAL_MS);

  for (const mailbox of mailboxes) {
    let accessToken = "mock_access_token";
    if (!options?.mockThreads) {
      try {
        if (mailbox.provider === "microsoft") {
          accessToken = await getValidMicrosoftAccessToken(mailbox.id);
        } else if (mailbox.provider === "imap_smtp") {
          accessToken = "imap_session";
        } else {
          accessToken = await getValidAccessToken(mailbox.id);
        }
      } catch (err: any) {
        console.warn(
          `[Poll Replies] Failed to obtain valid credentials for mailbox ${mailbox.id} (${mailbox.provider}):`,
          err?.message || err
        );
        continue;
      }
    }

    // Query sent drafts belonging to campaigns within this mailbox's organization
    const eligibleDrafts = await db
      .select({
        id: gtmEmailDraft.id,
        contactId: gtmEmailDraft.contactId,
        subject: gtmEmailDraft.subject,
        body: gtmEmailDraft.body,
        providerMessageId: gtmEmailDraft.providerMessageId,
        threadId: gtmEmailDraft.threadId,
        sentAt: gtmEmailDraft.sentAt,
        lastPolledAt: gtmEmailDraft.lastPolledAt,
        negotiationTurns: gtmEmailDraft.negotiationTurns,
        contactName: gtmContact.name,
        contactEmail: gtmContact.email,
        contactTitle: gtmContact.title,
        prospectCompanyId: gtmContact.prospectCompanyId,
        prospectCompanyName: gtmProspectCompany.name,
        campaignId: gtmEmailDraft.outreachCampaignId,
        companyName: gtmResearchRun.companyName,
        companyDescription: gtmResearchRun.companyDescription,
        contextDoc: gtmResearchRun.contextDoc,
        synthesizedProfile: gtmResearchRun.synthesizedProfile,
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
      .leftJoin(
        gtmProspectCompany,
        eq(gtmContact.prospectCompanyId, gtmProspectCompany.id)
      )
      .where(
        and(
          eq(gtmResearchRun.organizationId, mailbox.organizationId),
          eq(gtmEmailDraft.status, "sent"),
          gte(gtmEmailDraft.sentAt, thirtyDaysAgo),
          options?.forcePoll
            ? sql`TRUE`
            : options?.manualBounceDraftIds?.length
              ? or(
                  isNull(gtmEmailDraft.lastPolledAt),
                  lt(gtmEmailDraft.lastPolledAt, minLastPolled),
                  inArray(gtmEmailDraft.id, options.manualBounceDraftIds)
                )
              : or(
                  isNull(gtmEmailDraft.lastPolledAt),
                  lt(gtmEmailDraft.lastPolledAt, minLastPolled)
                )
        )
      );

    for (const draft of eligibleDrafts) {
      // Check manual bounce override if specified (e.g. manual trigger against verified bounce thread)
      if (options?.manualBounceDraftIds?.includes(draft.id)) {
        bouncesDetected++;
        await recordBounceForDraft({
          draftId: draft.id,
          rawSnippet:
            "Delivery Status Notification (Failure): Address not found (550)",
          occurredAt: new Date(),
        });
        continue;
      }

      if (!draft.providerMessageId) continue;

      let effectiveThreadId = draft.threadId;

      // If threadId is not yet cached on the draft row, resolve it once
      if (!effectiveThreadId) {
        if (mailbox.provider === "gmail") {
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
        } else {
          effectiveThreadId = draft.providerMessageId;
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

      // Fetch the full thread across providers (Gmail, Microsoft 365, or IMAP)
      let thread: { id: string; messages: any[] };
      try {
        if (options?.mockThreads?.has(effectiveThreadId)) {
          thread = options.mockThreads.get(effectiveThreadId);
        } else if (mailbox.provider === "microsoft") {
          const msMessages = await getMicrosoftConversationMessages({
            accessToken,
            conversationId: effectiveThreadId,
          });
          thread = {
            id: effectiveThreadId,
            messages: msMessages.map((m) => {
              const norm = normalizeMicrosoftMessage(m, mailbox.email);
              return {
                id: norm.id,
                threadId: norm.threadId,
                snippet: norm.snippet,
                internalDate: String(norm.timestamp.getTime()),
                payload: {
                  headers: [
                    {
                      name: "From",
                      value: norm.fromName ? `"${norm.fromName}" <${norm.from}>` : norm.from,
                    },
                    { name: "To", value: norm.to },
                    { name: "Subject", value: norm.subject },
                    ...Object.entries(norm.headers || {}).map(([name, value]) => ({
                      name,
                      value,
                    })),
                  ],
                  body: { data: Buffer.from(norm.body, "utf-8").toString("base64url") },
                },
              };
            }),
          };
        } else if (mailbox.provider === "imap_smtp") {
          const imapMessages = await pollImapMessages({
            mailboxId: mailbox.id,
            sinceDate: thirtyDaysAgo,
          });
          const matched = imapMessages.filter(
            (im) =>
              im.threadId === effectiveThreadId ||
              (draft.providerMessageId && im.headers?.["in-reply-to"] === draft.providerMessageId) ||
              (draft.providerMessageId && im.headers?.["references"]?.includes(draft.providerMessageId)) ||
              (im.from.toLowerCase() === draft.contactEmail?.toLowerCase() &&
                im.subject.toLowerCase().includes(draft.subject.toLowerCase().replace(/^re:\s*/i, "")))
          );

          thread = {
            id: effectiveThreadId,
            messages: [
              {
                id: draft.providerMessageId,
                threadId: effectiveThreadId,
                snippet: draft.body.slice(0, 100),
                internalDate: String(draft.sentAt ? draft.sentAt.getTime() : Date.now()),
                payload: {
                  headers: [
                    { name: "From", value: mailbox.email },
                    { name: "To", value: draft.contactEmail || "" },
                    { name: "Subject", value: draft.subject },
                  ],
                  body: { data: Buffer.from(draft.body, "utf-8").toString("base64url") },
                },
              },
              ...matched.map((im) => ({
                id: im.id,
                threadId: im.threadId,
                snippet: im.snippet,
                internalDate: String(im.timestamp.getTime()),
                payload: {
                  headers: [
                    {
                      name: "From",
                      value: im.fromName ? `"${im.fromName}" <${im.from}>` : im.from,
                    },
                    { name: "To", value: im.to },
                    { name: "Subject", value: im.subject },
                    ...Object.entries(im.headers || {}).map(([name, value]) => ({
                      name,
                      value,
                    })),
                  ],
                  body: { data: Buffer.from(im.body, "utf-8").toString("base64url") },
                },
              })),
            ],
          };
        } else {
          thread = await getGmailThread({
            accessToken,
            threadId: effectiveThreadId,
          });
        }
      } catch (threadErr: any) {
        console.warn(
          `[Poll Replies] Thread fetch failed for thread ${effectiveThreadId} (${mailbox.provider}):`,
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

      const messages = thread?.messages || [];
      if (messages.length <= 1) {
        // No replies in this thread yet
        continue;
      }

      // Sort thread messages chronologically
      const sortedMessages = [...messages].sort(
        (a, b) =>
          parseInt(a.internalDate || "0", 10) -
          parseInt(b.internalDate || "0", 10)
      );

      const mailboxEmailNormalized = mailbox.email.trim().toLowerCase();
      const isMsgSentByMailbox = (msg: GmailThreadMessage): boolean => {
        if (msg.id === draft.providerMessageId) return true;
        const fromHeader = extractMessageHeader(msg, "From") || "";
        return fromHeader.toLowerCase().includes(mailboxEmailNormalized);
      };

      const latestThreadMessage = sortedMessages[sortedMessages.length - 1];

      // If the latest message in thread was sent by us, we are awaiting prospect response
      if (isMsgSentByMailbox(latestThreadMessage)) {
        continue;
      }

      // Check delivery failure / bounce notifications
      const bounceCheck = isBounceMessage(latestThreadMessage);
      if (bounceCheck.isBounce) {
        bouncesDetected++;
        const bounceBody = extractMessageBody(latestThreadMessage);
        const rawSnippet =
          latestThreadMessage.snippet ||
          bounceBody.slice(0, 500) ||
          bounceCheck.reason ||
          "Delivery Status Notification (Failure): Recipient address not found (550)";
        const occurredAt = latestThreadMessage.internalDate
          ? new Date(parseInt(latestThreadMessage.internalDate, 10))
          : new Date();

        await recordBounceForDraft({
          draftId: draft.id,
          rawSnippet,
          occurredAt,
        });
        continue;
      }

      // Fetch all recorded events for this draft
      const existingEvents = await db
        .select()
        .from(gtmEmailEvent)
        .where(eq(gtmEmailEvent.emailDraftId, draft.id))
        .orderBy(gtmEmailEvent.occurredAt);

      // Check idempotency: have we already processed this specific incoming message?
      const alreadyProcessed = existingEvents.some(
        (evt) =>
          evt.providerMessageId === latestThreadMessage.id ||
          (evt.type === "replied" &&
            evt.rawSnippet &&
            latestThreadMessage.snippet &&
            evt.rawSnippet.includes(latestThreadMessage.snippet.slice(0, 50)))
      );

      if (alreadyProcessed) {
        continue;
      }

      // Stop Condition 1: Check if contact already has a confirmed meeting booking (Cal.com webhook)
      const [existingBooking] = await db
        .select({ id: gtmMeeting.id, status: gtmMeeting.status })
        .from(gtmMeeting)
        .where(
          and(
            eq(gtmMeeting.contactId, draft.contactId),
            eq(gtmMeeting.status, "booked")
          )
        )
        .limit(1);

      if (existingBooking) {
        console.log(
          `[Poll Replies] Contact ${draft.contactId} already booked meeting ${existingBooking.id}. Terminating reply loop.`
        );
        continue;
      }

      // Stop Condition 2: Explicit decline previously received
      const previouslyDeclined = existingEvents.some(
        (evt) =>
          evt.type === "replied" && evt.classifiedIntent === "not_interested"
      );
      if (previouslyDeclined) {
        console.log(
          `[Poll Replies] Contact ${draft.contactId} previously declined outreach. Terminating reply loop.`
        );
        continue;
      }

      repliesDetected++;

      const replyText = extractMessageBody(latestThreadMessage);
      const rawSnippet = latestThreadMessage.snippet || replyText.slice(0, 500);
      const occurredAt = latestThreadMessage.internalDate
        ? new Date(parseInt(latestThreadMessage.internalDate, 10))
        : new Date();

      // Build structured thread history across all messages
      const conversationHistory: ConversationTurn[] = [];
      for (const msg of sortedMessages) {
        const sentByUs = isMsgSentByMailbox(msg);
        const msgBody =
          extractMessageBody(msg) ||
          (msg.id === draft.providerMessageId
            ? draft.body
            : msg.snippet || "");
        const time = msg.internalDate
          ? new Date(parseInt(msg.internalDate, 10))
          : undefined;

        if (sentByUs) {
          conversationHistory.push({
            role: "agent",
            senderName: "Our Team",
            body: msgBody,
            timestamp: time,
          });
        } else {
          const matchingEvt = existingEvents.find(
            (e) => e.providerMessageId === msg.id
          );
          conversationHistory.push({
            role: "prospect",
            senderName: draft.contactName,
            body: msgBody,
            timestamp: time,
            intent: (matchingEvt?.classifiedIntent as ReplyIntent) || null,
          });
        }
      }

      // Classify latest prospect message with full thread context
      const classification = await classifyReplyIntent({
        replyText: replyText || rawSnippet,
        originalSubject: draft.subject,
        originalBody: draft.body,
        conversationHistory,
      });

      // Handle auto_reply (out-of-office): record event but do NOT count as turn or send follow-up
      if (classification.intent === "auto_reply") {
        await db.insert(gtmEmailEvent).values({
          emailDraftId: draft.id,
          type: "replied",
          classifiedIntent: "auto_reply",
          rawSnippet: rawSnippet.slice(0, 2000),
          providerMessageId: latestThreadMessage.id,
          occurredAt,
        });
        continue;
      }

      // Handle explicit decline: record event, mark draft, stop permanently
      if (classification.intent === "not_interested") {
        await db.insert(gtmEmailEvent).values({
          emailDraftId: draft.id,
          type: "replied",
          classifiedIntent: "not_interested",
          rawSnippet: rawSnippet.slice(0, 2000),
          providerMessageId: latestThreadMessage.id,
          metadata: {
            intentReasoning: classification.reasoning,
          },
          occurredAt,
        });
        await db
          .update(gtmEmailDraft)
          .set({
            errorMessage: "Prospect explicitly declined outreach (not_interested)",
          })
          .where(eq(gtmEmailDraft.id, draft.id));
        continue;
      }

      // Turn Cap Check: count how many outbound negotiation turns have been sent after the initial email
      const outboundFollowUpsSent = sortedMessages.filter(
        (m) => isMsgSentByMailbox(m) && m.id !== draft.providerMessageId
      ).length;

      const maxTurns = options?.maxNegotiationTurns ?? MAX_NEGOTIATION_TURNS;

      if (outboundFollowUpsSent >= maxTurns) {
        console.log(
          `[Poll Replies] Draft ${draft.id} reached maximum negotiation turns (${outboundFollowUpsSent}/${maxTurns}). Flagging for human attention.`
        );
        await db.insert(gtmEmailEvent).values({
          emailDraftId: draft.id,
          type: "replied",
          classifiedIntent: classification.intent,
          rawSnippet: rawSnippet.slice(0, 2000),
          providerMessageId: latestThreadMessage.id,
          metadata: {
            intentReasoning: classification.reasoning,
            turnCapExhausted: true,
          },
          occurredAt,
        });
        await db
          .update(gtmEmailDraft)
          .set({
            errorMessage: `Needs human attention: reached maximum negotiation turns (${maxTurns})`,
            negotiationTurns: outboundFollowUpsSent,
          })
          .where(eq(gtmEmailDraft.id, draft.id));
        continue;
      }

      // Send auto-response for interested, question, or unclear
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

      let replyBody: string;

      if (classification.intent === "interested") {
        replyBody = await composeInterestedBookingReply({
          recipientName: draft.contactName,
          bookingUrl,
          replyText,
          conversationHistory,
        });
      } else {
        // 'question' or 'unclear' (objections, inquiries, next quarter)
        replyBody = await composeNegotiationReply({
          recipientName: draft.contactName,
          contactTitle: draft.contactTitle,
          prospectCompanyName: draft.prospectCompanyName,
          conversationHistory,
          latestReplyText: replyText || rawSnippet,
          classifiedIntent: classification.intent,
          groundedContext: {
            companyName: draft.companyName,
            companyDescription: draft.companyDescription,
            productFocus: draft.synthesizedProfile?.productFocus,
            targetCustomerLanguage:
              draft.synthesizedProfile?.targetCustomerLanguage,
            synthesizedProfileSummary: draft.synthesizedProfile?.summary,
            contextDoc: draft.contextDoc,
            bookingUrl,
          },
        });
      }

      const fromHeader = extractMessageHeader(latestThreadMessage, "From") || "";
      const emailMatch = fromHeader.match(/<([^>]+)>/);
      const recipientEmail = emailMatch
        ? emailMatch[1].trim()
        : draft.contactEmail || fromHeader.trim();

      const cleanSubject = draft.subject.toLowerCase().startsWith("re:")
        ? draft.subject
        : `Re: ${draft.subject}`;

      try {
        if (options?.mockSender) {
          await options.mockSender({
            accessToken,
            to: recipientEmail,
            subject: cleanSubject,
            body: replyBody,
            fromEmail: mailbox.email,
            threadId: effectiveThreadId,
            inReplyTo: latestThreadMessage.id,
            references: latestThreadMessage.id,
          });
        } else {
          await sendEmailThroughMailbox({
            mailbox,
            to: recipientEmail,
            subject: cleanSubject,
            body: replyBody,
            threadId: effectiveThreadId,
            inReplyTo: latestThreadMessage.id,
            references: latestThreadMessage.id,
          });
        }

        autoRepliesSent++;
        currentDailyCount += 1;

        await db
          .update(gtmConnectedMailbox)
          .set({
            dailySendCount: currentDailyCount,
            lastSendResetDate: todayStr,
            updatedAt: new Date(),
          })
          .where(eq(gtmConnectedMailbox.id, mailbox.id));

        const newTurnNumber = outboundFollowUpsSent + 1;

        await db.insert(gtmEmailEvent).values({
          emailDraftId: draft.id,
          type: "replied",
          classifiedIntent: classification.intent,
          rawSnippet: rawSnippet.slice(0, 2000),
          providerMessageId: latestThreadMessage.id,
          metadata: {
            agentReplyBody: replyBody,
            turnNumber: newTurnNumber,
            intentReasoning: classification.reasoning,
          },
          occurredAt,
        });

        await db
          .update(gtmEmailDraft)
          .set({
            negotiationTurns: newTurnNumber,
            errorMessage: null,
            lastPolledAt: new Date(),
          })
          .where(eq(gtmEmailDraft.id, draft.id));
      } catch (sendErr: any) {
        console.error(
          `[Poll Replies] Failed to send auto-reply for draft ${draft.id}:`,
          sendErr?.message || sendErr
        );
      }
    }
  }

  return {
    mailboxesChecked: mailboxes.length,
    threadsPolled,
    repliesDetected,
    bouncesDetected,
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
    const manualBounceDraftIds = (event as any)?.data?.manualBounceDraftIds;

    return await step.run("poll-mailboxes-for-replies", async () => {
      return await executePollReplies(mailboxId, step, {
        manualBounceDraftIds,
      });
    });
  }
);

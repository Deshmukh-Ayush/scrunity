import { and, eq } from "drizzle-orm"
import { db } from "@/utils/db"
import {
  gtmConnectedMailbox,
  gtmEmailDraft,
  gtmEmailEvent,
  gtmMeeting,
} from "@/db/schema"
import {
  extractMessageBody,
  extractMessageHeader,
  type GmailThreadMessage,
} from "@/lib/gmail"
import { sendEmailThroughMailbox } from "@/lib/mailbox-dispatcher"
import {
  classifyReplyIntent,
  composeInterestedBookingReply,
  composeNegotiationReply,
  type ConversationTurn,
  type ReplyIntent,
} from "@/lib/gtm-ai"
import { isBounceMessage } from "@/lib/gtm-bounce"
import type { EligibleDraft } from "./eligible-drafts"
import type { ConnectedMailbox, ProviderThread } from "./provider-thread"
import { recordBounceForDraft } from "./record-bounce"

export const DAILY_SEND_CAP = 50

type EmailEventRow = typeof gtmEmailEvent.$inferSelect

export interface ReplyOutcome {
  bounceDetected: boolean
  replyDetected: boolean
  autoReplySent: boolean
}

const NOTHING: ReplyOutcome = {
  bounceDetected: false,
  replyDetected: false,
  autoReplySent: false,
}

const messageTime = (msg: GmailThreadMessage) =>
  msg.internalDate ? new Date(parseInt(msg.internalDate, 10)) : undefined

/** Whole thread as agent/prospect turns, tagging prospect turns with any recorded intent. */
function buildConversationHistory(
  sortedMessages: GmailThreadMessage[],
  draft: EligibleDraft,
  existingEvents: EmailEventRow[],
  isMsgSentByMailbox: (msg: GmailThreadMessage) => boolean
): ConversationTurn[] {
  return sortedMessages.map((msg) => {
    const body =
      extractMessageBody(msg) ||
      (msg.id === draft.providerMessageId ? draft.body : msg.snippet || "")
    const timestamp = messageTime(msg)

    if (isMsgSentByMailbox(msg)) {
      return { role: "agent", senderName: "Our Team", body, timestamp }
    }
    const matchingEvt = existingEvents.find(
      (e) => e.providerMessageId === msg.id
    )
    return {
      role: "prospect",
      senderName: draft.contactName,
      body,
      timestamp,
      intent: (matchingEvt?.classifiedIntent as ReplyIntent) || null,
    }
  })
}

/** Booked meeting or an earlier explicit decline both end the reply loop for a contact. */
async function shouldStopNegotiating(
  draft: EligibleDraft,
  existingEvents: EmailEventRow[]
) {
  const [existingBooking] = await db
    .select({ id: gtmMeeting.id, status: gtmMeeting.status })
    .from(gtmMeeting)
    .where(
      and(
        eq(gtmMeeting.contactId, draft.contactId),
        eq(gtmMeeting.status, "booked")
      )
    )
    .limit(1)

  if (existingBooking) {
    console.log(
      `[Poll Replies] Contact ${draft.contactId} already booked meeting ${existingBooking.id}. Terminating reply loop.`
    )
    return true
  }

  const previouslyDeclined = existingEvents.some(
    (evt) => evt.type === "replied" && evt.classifiedIntent === "not_interested"
  )
  if (previouslyDeclined) {
    console.log(
      `[Poll Replies] Contact ${draft.contactId} previously declined outreach. Terminating reply loop.`
    )
    return true
  }
  return false
}

/** Drafts a booking reply for interested prospects, or a grounded negotiation reply otherwise. */
function composeAutoReply(
  draft: EligibleDraft,
  intent: ReplyIntent,
  replyText: string,
  rawSnippet: string,
  conversationHistory: ConversationTurn[]
) {
  const bookingUrl =
    process.env.CALCOM_BOOKING_URL || "https://cal.com/sales-team/15min"

  if (intent === "interested") {
    return composeInterestedBookingReply({
      recipientName: draft.contactName,
      bookingUrl,
      replyText,
      conversationHistory,
    })
  }

  // 'question' or 'unclear' (objections, inquiries, next quarter)
  return composeNegotiationReply({
    recipientName: draft.contactName,
    contactTitle: draft.contactTitle,
    prospectCompanyName: draft.prospectCompanyName,
    conversationHistory,
    latestReplyText: replyText || rawSnippet,
    classifiedIntent: intent,
    groundedContext: {
      companyName: draft.companyName,
      companyDescription: draft.companyDescription,
      productFocus: draft.synthesizedProfile?.productFocus,
      targetCustomerLanguage: draft.synthesizedProfile?.targetCustomerLanguage,
      synthesizedProfileSummary: draft.synthesizedProfile?.summary,
      contextDoc: draft.contextDoc,
      bookingUrl,
    },
  })
}

/**
 * Handles the newest message of a polled thread: detects bounces, skips our own
 * messages and already-processed replies, honours stop conditions, classifies the
 * reply, and (within the turn and daily caps) sends an auto-response.
 */
export async function processLatestReply({
  mailbox,
  draft,
  thread,
  threadId,
  accessToken,
  maxTurns,
  mockSender,
}: {
  mailbox: ConnectedMailbox
  draft: EligibleDraft
  thread: ProviderThread
  threadId: string
  accessToken: string
  maxTurns: number
  mockSender?: (params: any) => Promise<any>
}): Promise<ReplyOutcome> {
  const messages = thread?.messages || []
  if (messages.length <= 1) return NOTHING // no replies yet

  const sortedMessages: GmailThreadMessage[] = [...messages].sort(
    (a, b) =>
      parseInt(a.internalDate || "0", 10) - parseInt(b.internalDate || "0", 10)
  )

  const mailboxEmailNormalized = mailbox.email.trim().toLowerCase()
  const isMsgSentByMailbox = (msg: GmailThreadMessage): boolean => {
    if (msg.id === draft.providerMessageId) return true
    const fromHeader = extractMessageHeader(msg, "From") || ""
    return fromHeader.toLowerCase().includes(mailboxEmailNormalized)
  }

  const latest = sortedMessages[sortedMessages.length - 1]

  // Our message is the newest: still waiting on the prospect.
  if (isMsgSentByMailbox(latest)) return NOTHING

  const bounceCheck = isBounceMessage(latest)
  if (bounceCheck.isBounce) {
    const bounceBody = extractMessageBody(latest)
    await recordBounceForDraft({
      draftId: draft.id,
      rawSnippet:
        latest.snippet ||
        bounceBody.slice(0, 500) ||
        bounceCheck.reason ||
        "Delivery Status Notification (Failure): Recipient address not found (550)",
      occurredAt: messageTime(latest) ?? new Date(),
    })
    return { ...NOTHING, bounceDetected: true }
  }

  const existingEvents = await db
    .select()
    .from(gtmEmailEvent)
    .where(eq(gtmEmailEvent.emailDraftId, draft.id))
    .orderBy(gtmEmailEvent.occurredAt)

  // Idempotency: this exact incoming message was already handled.
  const alreadyProcessed = existingEvents.some(
    (evt) =>
      evt.providerMessageId === latest.id ||
      (evt.type === "replied" &&
        evt.rawSnippet &&
        latest.snippet &&
        evt.rawSnippet.includes(latest.snippet.slice(0, 50)))
  )
  if (alreadyProcessed) return NOTHING

  if (await shouldStopNegotiating(draft, existingEvents)) return NOTHING

  const outcome: ReplyOutcome = { ...NOTHING, replyDetected: true }

  const replyText = extractMessageBody(latest)
  const rawSnippet = latest.snippet || replyText.slice(0, 500)
  const occurredAt = messageTime(latest) ?? new Date()
  const conversationHistory = buildConversationHistory(
    sortedMessages,
    draft,
    existingEvents,
    isMsgSentByMailbox
  )

  const classification = await classifyReplyIntent({
    replyText: replyText || rawSnippet,
    originalSubject: draft.subject,
    originalBody: draft.body,
    conversationHistory,
  })

  const replyEvent = (metadata?: Record<string, unknown>) => ({
    emailDraftId: draft.id,
    type: "replied" as const,
    classifiedIntent: classification.intent,
    rawSnippet: rawSnippet.slice(0, 2000),
    providerMessageId: latest.id,
    ...(metadata ? { metadata } : {}),
    occurredAt,
  })

  // Out-of-office: record it, but it neither counts as a turn nor gets a reply.
  if (classification.intent === "auto_reply") {
    await db.insert(gtmEmailEvent).values(replyEvent())
    return outcome
  }

  // Explicit decline: record it and stop permanently.
  if (classification.intent === "not_interested") {
    await db
      .insert(gtmEmailEvent)
      .values(replyEvent({ intentReasoning: classification.reasoning }))
    await db
      .update(gtmEmailDraft)
      .set({
        errorMessage: "Prospect explicitly declined outreach (not_interested)",
      })
      .where(eq(gtmEmailDraft.id, draft.id))
    return outcome
  }

  // Turn cap: outbound follow-ups already sent after the initial email.
  const outboundFollowUpsSent = sortedMessages.filter(
    (m) => isMsgSentByMailbox(m) && m.id !== draft.providerMessageId
  ).length

  if (outboundFollowUpsSent >= maxTurns) {
    console.log(
      `[Poll Replies] Draft ${draft.id} reached maximum negotiation turns (${outboundFollowUpsSent}/${maxTurns}). Flagging for human attention.`
    )
    await db
      .insert(gtmEmailEvent)
      .values(
        replyEvent({
          intentReasoning: classification.reasoning,
          turnCapExhausted: true,
        })
      )
    await db
      .update(gtmEmailDraft)
      .set({
        errorMessage: `Needs human attention: reached maximum negotiation turns (${maxTurns})`,
        negotiationTurns: outboundFollowUpsSent,
      })
      .where(eq(gtmEmailDraft.id, draft.id))
    return outcome
  }

  // Daily send cap for the mailbox.
  const todayStr = new Date().toISOString().slice(0, 10)
  const currentDailyCount =
    mailbox.lastSendResetDate === todayStr ? mailbox.dailySendCount : 0
  if (currentDailyCount >= DAILY_SEND_CAP) {
    console.warn(
      `[Poll Replies] Daily send cap reached for mailbox ${mailbox.email} (${currentDailyCount}/${DAILY_SEND_CAP}). Skipping auto-response.`
    )
    return outcome
  }

  const replyBody = await composeAutoReply(
    draft,
    classification.intent,
    replyText,
    rawSnippet,
    conversationHistory
  )

  const fromHeader = extractMessageHeader(latest, "From") || ""
  const emailMatch = fromHeader.match(/<([^>]+)>/)
  const recipientEmail = emailMatch
    ? emailMatch[1].trim()
    : draft.contactEmail || fromHeader.trim()
  const subject = draft.subject.toLowerCase().startsWith("re:")
    ? draft.subject
    : `Re: ${draft.subject}`

  try {
    if (mockSender) {
      await mockSender({
        accessToken,
        to: recipientEmail,
        subject,
        body: replyBody,
        fromEmail: mailbox.email,
        threadId,
        inReplyTo: latest.id,
        references: latest.id,
      })
    } else {
      await sendEmailThroughMailbox({
        mailbox,
        to: recipientEmail,
        subject,
        body: replyBody,
        threadId,
        inReplyTo: latest.id,
        references: latest.id,
      })
    }
    outcome.autoReplySent = true

    await db
      .update(gtmConnectedMailbox)
      .set({
        dailySendCount: currentDailyCount + 1,
        lastSendResetDate: todayStr,
        updatedAt: new Date(),
      })
      .where(eq(gtmConnectedMailbox.id, mailbox.id))

    const newTurnNumber = outboundFollowUpsSent + 1
    await db.insert(gtmEmailEvent).values(
      replyEvent({
        agentReplyBody: replyBody,
        turnNumber: newTurnNumber,
        intentReasoning: classification.reasoning,
      })
    )
    await db
      .update(gtmEmailDraft)
      .set({
        negotiationTurns: newTurnNumber,
        errorMessage: null,
        lastPolledAt: new Date(),
      })
      .where(eq(gtmEmailDraft.id, draft.id))
  } catch (sendErr: any) {
    console.error(
      `[Poll Replies] Failed to send auto-reply for draft ${draft.id}:`,
      sendErr?.message || sendErr
    )
  }

  return outcome
}

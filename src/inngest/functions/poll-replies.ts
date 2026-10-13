import { inngest, type GtmEvents } from "../client"
import { db } from "@/utils/db"
import { gtmConnectedMailbox, gtmEmailDraft } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import { getValidAccessToken } from "@/lib/gmail"
import { getValidMicrosoftAccessToken } from "@/lib/microsoft"
import {
  listEligibleDrafts,
  type EligibleDraft,
} from "@/lib/reply-polling/eligible-drafts"
import {
  fetchProviderThread,
  resolveDraftThreadId,
  type ConnectedMailbox,
} from "@/lib/reply-polling/provider-thread"
import { processLatestReply } from "@/lib/reply-polling/process-reply"
import { recordBounceForDraft } from "@/lib/reply-polling/record-bounce"
import { type InngestStep } from "./shared"

export { recordBounceForDraft }

const LOOKBACK_WINDOW_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
const POLL_INTERVAL_MS = 9 * 60 * 1000 // 9 minutes
export const MAX_NEGOTIATION_TURNS = 3

export interface PollRepliesOptions {
  manualBounceDraftIds?: string[]
  maxNegotiationTurns?: number
  mockThreads?: Map<string, any>
  mockSender?: (params: any) => Promise<any>
  forcePoll?: boolean
}

export interface PollRepliesResult {
  mailboxesChecked: number
  threadsPolled: number
  repliesDetected: number
  bouncesDetected: number
  autoRepliesSent: number
}

/** OAuth token for Gmail/Microsoft mailboxes; IMAP and test runs need no token. Null on failure. */
async function getMailboxAccessToken(
  mailbox: ConnectedMailbox,
  options?: PollRepliesOptions
): Promise<string | null> {
  if (options?.mockThreads) return "mock_access_token"
  try {
    if (mailbox.provider === "microsoft")
      return await getValidMicrosoftAccessToken(mailbox.id)
    if (mailbox.provider === "imap_smtp") return "imap_session"
    return await getValidAccessToken(mailbox.id)
  } catch (err: any) {
    console.warn(
      `[Poll Replies] Failed to obtain valid credentials for mailbox ${mailbox.id} (${mailbox.provider}):`,
      err?.message || err
    )
    return null
  }
}

const markPolled = (draftId: string) =>
  db
    .update(gtmEmailDraft)
    .set({ lastPolledAt: new Date() })
    .where(eq(gtmEmailDraft.id, draftId))

/** Polls one sent draft's thread and adds what happened to the running totals. */
async function pollDraft(
  mailbox: ConnectedMailbox,
  draft: EligibleDraft,
  accessToken: string,
  sinceDate: Date,
  totals: PollRepliesResult,
  options?: PollRepliesOptions
) {
  // Manual override: treat the draft as bounced without fetching the thread.
  if (options?.manualBounceDraftIds?.includes(draft.id)) {
    totals.bouncesDetected++
    await recordBounceForDraft({
      draftId: draft.id,
      rawSnippet:
        "Delivery Status Notification (Failure): Address not found (550)",
      occurredAt: new Date(),
    })
    return
  }

  if (!draft.providerMessageId) return

  const threadId = await resolveDraftThreadId(mailbox, draft, accessToken)
  if (!threadId) {
    // Mark as polled so unresolvable drafts are not retried every run.
    await markPolled(draft.id)
    return
  }

  let thread
  try {
    thread = await fetchProviderThread({
      mailbox,
      draft,
      threadId,
      accessToken,
      sinceDate,
      mockThreads: options?.mockThreads,
    })
  } catch (threadErr: any) {
    console.warn(
      `[Poll Replies] Thread fetch failed for thread ${threadId} (${mailbox.provider}):`,
      threadErr?.message || threadErr
    )
    await markPolled(draft.id)
    return
  }

  totals.threadsPolled++
  await markPolled(draft.id)

  const outcome = await processLatestReply({
    mailbox,
    draft,
    thread,
    threadId,
    accessToken,
    maxTurns: options?.maxNegotiationTurns ?? MAX_NEGOTIATION_TURNS,
    mockSender: options?.mockSender,
  })
  if (outcome.bounceDetected) totals.bouncesDetected++
  if (outcome.replyDetected) totals.repliesDetected++
  if (outcome.autoReplySent) totals.autoRepliesSent++
}

/**
 * Stage 8 core logic: poll connected mailboxes for replies, detect bounces,
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
    )

  const totals: PollRepliesResult = {
    mailboxesChecked: mailboxes.length,
    threadsPolled: 0,
    repliesDetected: 0,
    bouncesDetected: 0,
    autoRepliesSent: 0,
  }

  const now = new Date()
  const sinceDate = new Date(now.getTime() - LOOKBACK_WINDOW_MS)
  const polledBefore = new Date(now.getTime() - POLL_INTERVAL_MS)

  for (const mailbox of mailboxes) {
    const accessToken = await getMailboxAccessToken(mailbox, options)
    if (!accessToken) continue

    const drafts = await listEligibleDrafts({
      organizationId: mailbox.organizationId,
      sentSince: sinceDate,
      polledBefore,
      forcePoll: options?.forcePoll,
      manualBounceDraftIds: options?.manualBounceDraftIds,
    })

    for (const draft of drafts) {
      await pollDraft(mailbox, draft, accessToken, sinceDate, totals, options)
    }
  }

  return totals
}

/**
 * Inngest Function: Scheduled cron to poll Gmail for replies every 10 minutes
 */
export const pollRepliesFunction = inngest.createFunction(
  {
    id: "gtm-poll-email-replies",
    name: "GTM: Poll Email Replies & Classify Intent",
    triggers: [{ cron: "*/10 * * * *" }, { event: "gtm/mailbox.poll_replies" }],
  },
  async ({
    event,
    step,
  }: {
    event: GtmEvents["gtm/mailbox.poll_replies"] | { data: {} }
    step: InngestStep
  }) => {
    const mailboxId = (event as any)?.data?.mailboxId
    const manualBounceDraftIds = (event as any)?.data?.manualBounceDraftIds

    return await step.run("poll-mailboxes-for-replies", async () => {
      return await executePollReplies(mailboxId, step, {
        manualBounceDraftIds,
      })
    })
  }
)

import { eq } from "drizzle-orm"
import { db } from "@/utils/db"
import { gtmConnectedMailbox, gtmEmailDraft } from "@/db/schema"
import { getGmailMessage, getGmailThread } from "@/lib/gmail"
import {
  getMicrosoftConversationMessages,
  normalizeMicrosoftMessage,
} from "@/lib/microsoft"
import { pollImapMessages } from "@/lib/imap-smtp"
import type { EligibleDraft } from "./eligible-drafts"

export type ConnectedMailbox = typeof gtmConnectedMailbox.$inferSelect

/**
 * A provider thread in Gmail's message shape (headers + base64url body), which
 * is what the reply-processing code reads for every provider.
 */
export interface ProviderThread {
  id: string
  messages: any[]
}

/**
 * The provider thread id for a sent draft. Gmail needs one lookup, which is then
 * cached on the draft row; Microsoft and IMAP key threads by the message id.
 * Returns null when the Gmail lookup fails.
 */
export async function resolveDraftThreadId(
  mailbox: ConnectedMailbox,
  draft: EligibleDraft,
  accessToken: string
): Promise<string | null> {
  if (draft.threadId) return draft.threadId
  if (mailbox.provider !== "gmail") return draft.providerMessageId

  try {
    const msgMeta = await getGmailMessage({
      accessToken,
      messageId: draft.providerMessageId!,
    })
    if (msgMeta.threadId) {
      await db
        .update(gtmEmailDraft)
        .set({ threadId: msgMeta.threadId })
        .where(eq(gtmEmailDraft.id, draft.id))
      return msgMeta.threadId
    }
  } catch (msgErr: any) {
    console.warn(
      `[Poll Replies] Could not resolve threadId for message ${draft.providerMessageId}:`,
      msgErr?.message || msgErr
    )
  }
  return null
}

const toBase64Url = (text: string) =>
  Buffer.from(text, "utf-8").toString("base64url")

function headersFor(
  from: string,
  fromName: string | undefined | null,
  to: string,
  subject: string,
  extra?: Record<string, string>
) {
  return [
    { name: "From", value: fromName ? `"${fromName}" <${from}>` : from },
    { name: "To", value: to },
    { name: "Subject", value: subject },
    ...Object.entries(extra || {}).map(([name, value]) => ({ name, value })),
  ]
}

async function fetchMicrosoftThread(
  mailbox: ConnectedMailbox,
  threadId: string,
  accessToken: string
): Promise<ProviderThread> {
  const msMessages = await getMicrosoftConversationMessages({
    accessToken,
    conversationId: threadId,
  })
  return {
    id: threadId,
    messages: msMessages.map((m) => {
      const norm = normalizeMicrosoftMessage(m, mailbox.email)
      return {
        id: norm.id,
        threadId: norm.threadId,
        snippet: norm.snippet,
        internalDate: String(norm.timestamp.getTime()),
        payload: {
          headers: headersFor(
            norm.from,
            norm.fromName,
            norm.to,
            norm.subject,
            norm.headers
          ),
          body: { data: toBase64Url(norm.body) },
        },
      }
    }),
  }
}

/**
 * IMAP has no server-side threads, so this rebuilds one: the sent draft plus any
 * inbox message that replies to it (by thread id, In-Reply-To/References, or
 * same sender and subject).
 */
async function fetchImapThread(
  mailbox: ConnectedMailbox,
  draft: EligibleDraft,
  threadId: string,
  sinceDate: Date
): Promise<ProviderThread> {
  const imapMessages = await pollImapMessages({
    mailboxId: mailbox.id,
    sinceDate,
  })
  const baseSubject = draft.subject.toLowerCase().replace(/^re:\s*/i, "")
  const matched = imapMessages.filter(
    (im) =>
      im.threadId === threadId ||
      (draft.providerMessageId &&
        im.headers?.["in-reply-to"] === draft.providerMessageId) ||
      (draft.providerMessageId &&
        im.headers?.["references"]?.includes(draft.providerMessageId)) ||
      (im.from.toLowerCase() === draft.contactEmail?.toLowerCase() &&
        im.subject.toLowerCase().includes(baseSubject))
  )

  return {
    id: threadId,
    messages: [
      {
        id: draft.providerMessageId,
        threadId,
        snippet: draft.body.slice(0, 100),
        internalDate: String(
          draft.sentAt ? draft.sentAt.getTime() : Date.now()
        ),
        payload: {
          headers: [
            { name: "From", value: mailbox.email },
            { name: "To", value: draft.contactEmail || "" },
            { name: "Subject", value: draft.subject },
          ],
          body: { data: toBase64Url(draft.body) },
        },
      },
      ...matched.map((im) => ({
        id: im.id,
        threadId: im.threadId,
        snippet: im.snippet,
        internalDate: String(im.timestamp.getTime()),
        payload: {
          headers: headersFor(
            im.from,
            im.fromName,
            im.to,
            im.subject,
            im.headers
          ),
          body: { data: toBase64Url(im.body) },
        },
      })),
    ],
  }
}

/** Fetches the full thread from Gmail, Microsoft 365 or IMAP (or a test mock). */
export async function fetchProviderThread({
  mailbox,
  draft,
  threadId,
  accessToken,
  sinceDate,
  mockThreads,
}: {
  mailbox: ConnectedMailbox
  draft: EligibleDraft
  threadId: string
  accessToken: string
  sinceDate: Date
  mockThreads?: Map<string, any>
}): Promise<ProviderThread> {
  if (mockThreads?.has(threadId)) return mockThreads.get(threadId)
  if (mailbox.provider === "microsoft")
    return fetchMicrosoftThread(mailbox, threadId, accessToken)
  if (mailbox.provider === "imap_smtp")
    return fetchImapThread(mailbox, draft, threadId, sinceDate)
  return getGmailThread({ accessToken, threadId })
}

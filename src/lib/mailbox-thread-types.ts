/** Shapes returned by GET /api/gtm/mailbox/threads, shared by server and client code. */

export interface MailboxMessage {
  id: string
  from: string
  fromName: string
  to: string
  toName: string
  timestamp: string
  body: string
  isOutbound: boolean
  classifiedIntent?: string | null
}

export interface MailboxThread {
  id: string
  draftId: string
  threadId: string | null
  subject: string
  contact: {
    id: string
    name: string
    email: string | null
    title: string
    linkedinUrl: string | null
  }
  company: {
    id: string | null
    name: string | null
    domain: string | null
  }
  campaign: {
    id: string
    name: string
  }
  sentAt: string
  lastActivityAt: string
  latestSnippet: string
  latestSender: string
  classifiedIntent:
    | "interested"
    | "not_interested"
    | "question"
    | "auto_reply"
    | "unclear"
    | null
  hasReply: boolean
  isUnread: boolean
  isBounced?: boolean
  bounceReason?: string | null
  messages: MailboxMessage[]
}

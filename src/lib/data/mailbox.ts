import "server-only"

import { db } from "@/utils/db"
import {
  gtmConnectedMailbox,
  gtmContact,
  gtmEmailDraft,
  gtmEmailEvent,
  gtmIcpSegment,
  gtmOutreachCampaign,
  gtmProspectCompany,
  gtmResearchRun,
} from "@/db/schema"
import { and, desc, eq, inArray, or, sql } from "drizzle-orm"
import type { MailboxMessage, MailboxThread } from "@/lib/mailbox-thread-types"
import { matchesFilter, matchesSearch } from "@/lib/mailbox-filters"

/**
 * The organization's sending mailbox, or null when none is connected.
 * Backs GET /api/gtm/mailbox.
 */
export async function getConnectedMailbox(organizationId: string) {
  const [mailbox] = await db
    .select({
      id: gtmConnectedMailbox.id,
      email: gtmConnectedMailbox.email,
      provider: gtmConnectedMailbox.provider,
      status: gtmConnectedMailbox.status,
      dailySendCount: gtmConnectedMailbox.dailySendCount,
      lastSendResetDate: gtmConnectedMailbox.lastSendResetDate,
      connectedAt: gtmConnectedMailbox.connectedAt,
      metadata: gtmConnectedMailbox.metadata,
    })
    .from(gtmConnectedMailbox)
    .where(eq(gtmConnectedMailbox.organizationId, organizationId))

  return mailbox && mailbox.status === "connected" ? mailbox : null
}

export interface MailboxThreadFilters {
  search?: string
  intent?: string | null
}

/**
 * Sent, bounced and failed outreach emails grouped into conversation threads
 * with their replies, plus the mailbox record (any status) they were sent from.
 * Backs GET /api/gtm/mailbox/threads and the server-rendered mailbox page.
 */
export async function getMailboxThreads(
  organizationId: string,
  filters: MailboxThreadFilters = {}
) {
  const search = filters.search?.toLowerCase().trim()

  // The mailbox lookup and the drafts query are independent, so run them together.
  const [[connectedMailbox], drafts] = await Promise.all([
    db
      .select({
        id: gtmConnectedMailbox.id,
        email: gtmConnectedMailbox.email,
        provider: gtmConnectedMailbox.provider,
        status: gtmConnectedMailbox.status,
        metadata: gtmConnectedMailbox.metadata,
      })
      .from(gtmConnectedMailbox)
      .where(eq(gtmConnectedMailbox.organizationId, organizationId)),
    listOutreachDrafts(organizationId),
  ])

  const mailbox = connectedMailbox || null
  if (!drafts.length) {
    return { mailbox, threads: [] as MailboxThread[], total: 0 }
  }

  const events = await listDraftEvents(drafts.map((d) => d.draftId))

  let threads = buildThreads(
    drafts,
    events,
    mailbox?.email || "outreach@scrunity.ai"
  )

  // Same predicates as the Mailbox page (lib/mailbox-filters.ts).
  if (search) threads = threads.filter((t) => matchesSearch(t, search))
  threads = threads.filter((t) => matchesFilter(t, filters.intent))

  return { mailbox, threads, total: threads.length }
}

type OutreachDraftRow = Awaited<ReturnType<typeof listOutreachDrafts>>[number]
type EmailEventRow = Awaited<ReturnType<typeof listDraftEvents>>[number]

/** Drafts that were sent, bounced, or failed after sending, newest first. */
function listOutreachDrafts(organizationId: string) {
  return db
    .select({
      draftId: gtmEmailDraft.id,
      subject: gtmEmailDraft.subject,
      body: gtmEmailDraft.body,
      status: gtmEmailDraft.status,
      sentAt: gtmEmailDraft.sentAt,
      threadId: gtmEmailDraft.threadId,
      contactId: gtmContact.id,
      contactName: gtmContact.name,
      contactEmail: gtmContact.email,
      contactTitle: gtmContact.title,
      contactLinkedin: gtmContact.linkedinUrl,
      companyId: gtmProspectCompany.id,
      companyName: gtmProspectCompany.name,
      companyDomain: gtmProspectCompany.domain,
      campaignId: gtmOutreachCampaign.id,
      campaignName: gtmIcpSegment.name,
    })
    .from(gtmEmailDraft)
    .innerJoin(gtmContact, eq(gtmEmailDraft.contactId, gtmContact.id))
    .leftJoin(
      gtmProspectCompany,
      eq(gtmContact.prospectCompanyId, gtmProspectCompany.id)
    )
    .innerJoin(
      gtmOutreachCampaign,
      eq(gtmEmailDraft.outreachCampaignId, gtmOutreachCampaign.id)
    )
    .innerJoin(
      gtmResearchRun,
      eq(gtmOutreachCampaign.researchRunId, gtmResearchRun.id)
    )
    .innerJoin(
      gtmIcpSegment,
      eq(gtmOutreachCampaign.icpSegmentId, gtmIcpSegment.id)
    )
    .where(
      and(
        eq(gtmResearchRun.organizationId, organizationId),
        or(
          eq(gtmEmailDraft.status, "sent"),
          sql`EXISTS (SELECT 1 FROM gtm_email_event e WHERE e.email_draft_id = ${gtmEmailDraft.id} AND e.type = 'bounced')`,
          sql`(${gtmEmailDraft.sentAt} IS NOT NULL AND ${gtmEmailDraft.status} = 'failed')`
        )
      )
    )
    .orderBy(desc(gtmEmailDraft.sentAt))
}

/** Every recorded event (replies, bounces) for the given drafts, oldest first. */
function listDraftEvents(draftIds: string[]) {
  return db
    .select({
      id: gtmEmailEvent.id,
      emailDraftId: gtmEmailEvent.emailDraftId,
      type: gtmEmailEvent.type,
      classifiedIntent: gtmEmailEvent.classifiedIntent,
      rawSnippet: gtmEmailEvent.rawSnippet,
      metadata: gtmEmailEvent.metadata,
      occurredAt: gtmEmailEvent.occurredAt,
    })
    .from(gtmEmailEvent)
    .where(inArray(gtmEmailEvent.emailDraftId, draftIds))
    .orderBy(gtmEmailEvent.occurredAt)
}

const byTimestamp = (a: MailboxMessage, b: MailboxMessage) =>
  new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()

/** One thread per provider thread id (or per draft), newest activity first. */
function buildThreads(
  drafts: OutreachDraftRow[],
  events: EmailEventRow[],
  mailboxEmail: string
): MailboxThread[] {
  const eventsByDraft = new Map<string, EmailEventRow[]>()
  for (const evt of events) {
    const list = eventsByDraft.get(evt.emailDraftId) || []
    list.push(evt)
    eventsByDraft.set(evt.emailDraftId, list)
  }

  const threadMap = new Map<string, MailboxThread>()

  for (const d of drafts) {
    const key = d.threadId || d.draftId
    const draftEvents = eventsByDraft.get(d.draftId) || []
    const replyEvents = draftEvents.filter((e) => e.type === "replied")
    const bounceEvents = draftEvents.filter((e) => e.type === "bounced")
    const messages = buildDraftMessages(
      d,
      replyEvents,
      bounceEvents,
      mailboxEmail
    )

    const latestMessage = messages[messages.length - 1]
    const latestReply = replyEvents[replyEvents.length - 1]
    const isBounced =
      bounceEvents.length > 0 || (d.status === "failed" && Boolean(d.sentAt))
    const bounceReason =
      bounceEvents[0]?.rawSnippet ||
      (isBounced ? "Delivery failed: Recipient address not found (550)" : null)

    const thread: MailboxThread = {
      id: key,
      draftId: d.draftId,
      threadId: d.threadId,
      subject: d.subject,
      contact: {
        id: d.contactId,
        name: d.contactName,
        email: d.contactEmail,
        title: d.contactTitle,
        linkedinUrl: d.contactLinkedin,
      },
      company: {
        id: d.companyId,
        name: d.companyName,
        domain: d.companyDomain,
      },
      campaign: { id: d.campaignId, name: d.campaignName },
      sentAt: (d.sentAt || new Date()).toISOString(),
      lastActivityAt: latestMessage.timestamp,
      latestSnippet: isBounced
        ? bounceReason || latestMessage.body
        : latestMessage.body,
      latestSender: isBounced
        ? "Mail Delivery Subsystem"
        : latestMessage.isOutbound
          ? "You"
          : d.contactName,
      classifiedIntent: isBounced
        ? null
        : (latestReply?.classifiedIntent as MailboxThread["classifiedIntent"]) ||
          null,
      hasReply: replyEvents.length > 0,
      isUnread: replyEvents.length > 0 || isBounced,
      isBounced,
      bounceReason,
      messages,
    }

    const existing = threadMap.get(key)
    if (!existing) {
      threadMap.set(key, thread)
      continue
    }

    // Several drafts in the same provider thread: merge their messages.
    existing.messages = [...existing.messages, ...messages].sort(byTimestamp)
    const newest = existing.messages[existing.messages.length - 1]
    existing.lastActivityAt = newest.timestamp
    existing.latestSnippet = newest.body
    existing.latestSender = newest.isOutbound ? "You" : d.contactName
    if (thread.classifiedIntent)
      existing.classifiedIntent = thread.classifiedIntent
    if (thread.hasReply) {
      existing.hasReply = true
      existing.isUnread = true
    }
  }

  return Array.from(threadMap.values()).sort(
    (a, b) =>
      new Date(b.lastActivityAt).getTime() -
      new Date(a.lastActivityAt).getTime()
  )
}

/** The outbound email, each reply (plus any agent follow-up), and bounce notices, oldest first. */
function buildDraftMessages(
  d: OutreachDraftRow,
  replyEvents: EmailEventRow[],
  bounceEvents: EmailEventRow[],
  mailboxEmail: string
): MailboxMessage[] {
  const prospectEmail = d.contactEmail || "prospect@company.com"
  const messages: MailboxMessage[] = [
    {
      id: d.draftId,
      from: mailboxEmail,
      fromName: "You",
      to: prospectEmail,
      toName: d.contactName,
      timestamp: (d.sentAt || new Date()).toISOString(),
      body: d.body,
      isOutbound: true,
    },
  ]

  for (const reply of replyEvents) {
    messages.push({
      id: reply.id,
      from: prospectEmail,
      fromName: d.contactName,
      to: mailboxEmail,
      toName: "You",
      timestamp: reply.occurredAt.toISOString(),
      body: reply.rawSnippet || "(Reply message content)",
      isOutbound: false,
      classifiedIntent: reply.classifiedIntent,
    })

    if (reply.metadata?.agentReplyBody) {
      messages.push({
        id: `${reply.id}-agent-followup`,
        from: mailboxEmail,
        fromName: "You",
        to: prospectEmail,
        toName: d.contactName,
        timestamp: new Date(
          new Date(reply.occurredAt).getTime() + 1000
        ).toISOString(),
        body: reply.metadata.agentReplyBody,
        isOutbound: true,
      })
    }
  }

  for (const bounce of bounceEvents) {
    messages.push({
      id: bounce.id,
      from: "mailer-daemon@googlemail.com",
      fromName: "Mail Delivery Subsystem",
      to: mailboxEmail,
      toName: "You",
      timestamp: bounce.occurredAt.toISOString(),
      body:
        bounce.rawSnippet ||
        "Delivery to the following recipient failed permanently: Recipient address not found (550).",
      isOutbound: false,
    })
  }

  return messages.sort(byTimestamp)
}

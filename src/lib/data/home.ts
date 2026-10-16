import "server-only"

import { and, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm"
import { db } from "@/utils/db"
import {
  gtmContact,
  gtmConversation,
  gtmEmailDraft,
  gtmEmailEvent,
  gtmIcpSegment,
  gtmMeeting,
  gtmMessage,
  gtmOutreachCampaign,
  gtmProspectCompany,
  gtmResearchRun,
} from "@/db/schema"

/**
 * Data for the Home page: what needs the user (campaigns waiting at a gate or
 * stopped), what happened around today (sends, replies, meetings) and whether
 * the organization has any chats yet. Every query is scoped to the
 * organization through gtm_research_run.
 *
 * "Today" is the user's local day, which the server does not know, so the
 * activity queries return a window of about a day and a half either side of
 * now; the client keeps only the rows on its local today.
 */

export type NeedsYouKind =
  | "awaiting_review"
  | "select_companies"
  | "approve_emails"
  | "send_approved"
  | "campaign_failed"

export interface NeedsYouItem {
  kind: NeedsYouKind
  campaignId: string
  segmentName: string
  count: number
  at: Date
}

export type TodayItem =
  | {
      kind: "sent"
      campaignId: string
      segmentName: string
      count: number
      at: Date
    }
  | {
      kind: "reply"
      contactId: string
      contactName: string
      companyName: string
      intent: string | null
      at: Date
    }
  | {
      kind: "meeting"
      contactId: string
      contactName: string
      companyName: string
      at: Date
    }

const ACTIVITY_WINDOW_MS = 36 * 60 * 60 * 1000

function listCampaignsNeedingYou(organizationId: string) {
  return db
    .select({
      id: gtmOutreachCampaign.id,
      status: gtmOutreachCampaign.status,
      currentStage: gtmOutreachCampaign.currentStage,
      createdAt: gtmOutreachCampaign.createdAt,
      lastProgressAt: gtmOutreachCampaign.lastProgressAt,
      segmentName: gtmIcpSegment.name,
      draftCount: sql<number>`(SELECT count(*)::int FROM gtm_email_draft d WHERE d.outreach_campaign_id = ${gtmOutreachCampaign.id} AND d.status = 'draft')`,
      approvedCount: sql<number>`(SELECT count(*)::int FROM gtm_email_draft d WHERE d.outreach_campaign_id = ${gtmOutreachCampaign.id} AND d.status = 'approved')`,
    })
    .from(gtmOutreachCampaign)
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
          eq(gtmOutreachCampaign.status, "failed"),
          // Awaiting approval is set on the status even when the stage still reads
          // find_contacts or write_emails, so match either.
          eq(gtmOutreachCampaign.status, "awaiting_approval"),
          inArray(gtmOutreachCampaign.currentStage, [
            "awaiting_company_selection",
            "awaiting_approval",
          ])
        )
      )
    )
    .orderBy(desc(gtmOutreachCampaign.createdAt))
    .limit(25)
}

function toNeedsYouItem(
  row: Awaited<ReturnType<typeof listCampaignsNeedingYou>>[number]
): NeedsYouItem | null {
  const base = {
    campaignId: row.id,
    segmentName: row.segmentName,
    at: row.lastProgressAt ?? row.createdAt,
  }
  if (row.status === "failed")
    return { ...base, kind: "campaign_failed", count: 0 }
  if (row.currentStage === "awaiting_company_selection")
    return { ...base, kind: "select_companies", count: 0 }
  if (
    row.currentStage === "awaiting_approval" ||
    row.status === "awaiting_approval"
  ) {
    if (row.draftCount > 0)
      return { ...base, kind: "approve_emails", count: row.draftCount }
    if (row.approvedCount > 0)
      return { ...base, kind: "send_approved", count: row.approvedCount }
    return { ...base, kind: "awaiting_review", count: 0 }
  }
  return null
}

function listRecentSends(organizationId: string, since: Date) {
  return db
    .select({
      campaignId: gtmOutreachCampaign.id,
      segmentName: gtmIcpSegment.name,
      sentAt: gtmEmailDraft.sentAt,
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
    .innerJoin(
      gtmIcpSegment,
      eq(gtmOutreachCampaign.icpSegmentId, gtmIcpSegment.id)
    )
    .where(
      and(
        eq(gtmResearchRun.organizationId, organizationId),
        eq(gtmEmailDraft.status, "sent"),
        gte(gtmEmailDraft.sentAt, since)
      )
    )
    .orderBy(desc(gtmEmailDraft.sentAt))
    .limit(500)
}

function listRecentReplies(organizationId: string, since: Date) {
  return db
    .select({
      contactId: gtmContact.id,
      contactName: gtmContact.name,
      companyName: gtmProspectCompany.name,
      intent: gtmEmailEvent.classifiedIntent,
      at: gtmEmailEvent.occurredAt,
    })
    .from(gtmEmailEvent)
    .innerJoin(gtmEmailDraft, eq(gtmEmailEvent.emailDraftId, gtmEmailDraft.id))
    .innerJoin(gtmContact, eq(gtmEmailDraft.contactId, gtmContact.id))
    .innerJoin(
      gtmProspectCompany,
      eq(gtmContact.prospectCompanyId, gtmProspectCompany.id)
    )
    .innerJoin(
      gtmOutreachCampaign,
      eq(gtmProspectCompany.outreachCampaignId, gtmOutreachCampaign.id)
    )
    .innerJoin(
      gtmResearchRun,
      eq(gtmOutreachCampaign.researchRunId, gtmResearchRun.id)
    )
    .where(
      and(
        eq(gtmResearchRun.organizationId, organizationId),
        eq(gtmEmailEvent.type, "replied"),
        gte(gtmEmailEvent.occurredAt, since)
      )
    )
    .orderBy(desc(gtmEmailEvent.occurredAt))
    .limit(50)
}

function listMeetingsAroundNow(
  organizationId: string,
  since: Date,
  until: Date
) {
  return db
    .select({
      contactId: gtmContact.id,
      contactName: gtmContact.name,
      companyName: gtmProspectCompany.name,
      at: gtmMeeting.scheduledAt,
    })
    .from(gtmMeeting)
    .innerJoin(gtmContact, eq(gtmMeeting.contactId, gtmContact.id))
    .innerJoin(
      gtmProspectCompany,
      eq(gtmContact.prospectCompanyId, gtmProspectCompany.id)
    )
    .innerJoin(
      gtmOutreachCampaign,
      eq(gtmProspectCompany.outreachCampaignId, gtmOutreachCampaign.id)
    )
    .innerJoin(
      gtmResearchRun,
      eq(gtmOutreachCampaign.researchRunId, gtmResearchRun.id)
    )
    .where(
      and(
        eq(gtmResearchRun.organizationId, organizationId),
        eq(gtmMeeting.status, "booked"),
        gte(gtmMeeting.scheduledAt, since),
        lte(gtmMeeting.scheduledAt, until)
      )
    )
    .orderBy(gtmMeeting.scheduledAt)
    .limit(50)
}

function hasAnyChat(organizationId: string) {
  return db
    .select({ id: gtmConversation.id })
    .from(gtmConversation)
    .where(
      and(
        eq(gtmConversation.organizationId, organizationId),
        sql`EXISTS (SELECT 1 FROM ${gtmMessage} WHERE ${gtmMessage.conversationId} = ${gtmConversation.id})`
      )
    )
    .limit(1)
}

export async function getHomeFeed(organizationId: string) {
  const now = Date.now()
  const since = new Date(now - ACTIVITY_WINDOW_MS)
  const until = new Date(now + ACTIVITY_WINDOW_MS)

  const [campaigns, sends, replies, meetings, chats] = await Promise.all([
    listCampaignsNeedingYou(organizationId),
    listRecentSends(organizationId, since),
    listRecentReplies(organizationId, since),
    listMeetingsAroundNow(organizationId, since, until),
    hasAnyChat(organizationId),
  ])

  const needsYou = campaigns
    .map(toNeedsYouItem)
    .filter((item): item is NeedsYouItem => item !== null)
  const activity: TodayItem[] = [
    // One row per send: the client keeps its local today and groups them per campaign.
    ...sends.flatMap((s) =>
      s.sentAt
        ? [
            {
              kind: "sent" as const,
              campaignId: s.campaignId,
              segmentName: s.segmentName,
              count: 1,
              at: s.sentAt,
            },
          ]
        : []
    ),
    ...replies.map((r) => ({ kind: "reply" as const, ...r })),
    ...meetings.map((m) => ({ kind: "meeting" as const, ...m })),
  ]

  return { needsYou, activity, hasChats: chats.length > 0 }
}

export type HomeFeed = Awaited<ReturnType<typeof getHomeFeed>>

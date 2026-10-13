import { and, eq, gte, inArray, isNull, lt, or, sql } from "drizzle-orm"
import { db } from "@/utils/db"
import {
  gtmContact,
  gtmEmailDraft,
  gtmOutreachCampaign,
  gtmProspectCompany,
  gtmResearchRun,
} from "@/db/schema"

/**
 * Sent drafts in the organization from the last 30 days that are due for a
 * reply check: not polled within the poll interval, or explicitly listed as a
 * manual bounce. `forcePoll` ignores the interval.
 */
export function listEligibleDrafts({
  organizationId,
  sentSince,
  polledBefore,
  forcePoll,
  manualBounceDraftIds,
}: {
  organizationId: string
  sentSince: Date
  polledBefore: Date
  forcePoll?: boolean
  manualBounceDraftIds?: string[]
}) {
  const duePolling = or(
    isNull(gtmEmailDraft.lastPolledAt),
    lt(gtmEmailDraft.lastPolledAt, polledBefore)
  )

  return db
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
        eq(gtmResearchRun.organizationId, organizationId),
        eq(gtmEmailDraft.status, "sent"),
        gte(gtmEmailDraft.sentAt, sentSince),
        forcePoll
          ? sql`TRUE`
          : manualBounceDraftIds?.length
            ? or(duePolling, inArray(gtmEmailDraft.id, manualBounceDraftIds))
            : duePolling
      )
    )
}

export type EligibleDraft = Awaited<
  ReturnType<typeof listEligibleDrafts>
>[number]

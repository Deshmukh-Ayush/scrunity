import "server-only"

import { db } from "@/utils/db"
import {
  gtmCompanyMetricSnapshot,
  gtmIcpSegment,
  gtmContact,
  gtmEmailDraft,
  gtmOutreachCampaign,
  gtmProspectCompany,
  gtmResearchRun,
} from "@/db/schema"
import { and, desc, eq, getTableColumns, inArray, sql } from "drizzle-orm"
import { verifyCampaignAccess } from "@/lib/gtm-auth"
import { getDecisionMakersPerCompany } from "@/lib/providers/config"
import { publicContactRow, publicPipelineRow } from "./public-fields"
import { skippedReason, usableLeadSql } from "./lead-visibility"

/**
 * Every outreach campaign in the organization, newest first, joined with the
 * research run it came from. Backs GET /api/gtm/campaigns and the server-rendered
 * campaign lists.
 */
export async function listOrgCampaigns(organizationId: string) {
  const rows = await db
    .select({
      campaign: gtmOutreachCampaign,
      researchRun: gtmResearchRun,
      // Display-only extras for the Campaigns table (same rows, same order).
      segmentName: gtmIcpSegment.name,
      draftCount: sql<number>`(SELECT count(*)::int FROM gtm_email_draft d WHERE d.outreach_campaign_id = ${gtmOutreachCampaign.id})`,
      sentCount: sql<number>`(SELECT count(*)::int FROM gtm_email_draft d WHERE d.outreach_campaign_id = ${gtmOutreachCampaign.id} AND d.status = 'sent')`,
      replyCount: sql<number>`(SELECT count(DISTINCT e.email_draft_id)::int FROM gtm_email_event e JOIN gtm_email_draft d ON d.id = e.email_draft_id WHERE d.outreach_campaign_id = ${gtmOutreachCampaign.id} AND e.type = 'replied')`,
    })
    .from(gtmOutreachCampaign)
    .innerJoin(
      gtmResearchRun,
      eq(gtmOutreachCampaign.researchRunId, gtmResearchRun.id)
    )
    .leftJoin(
      gtmIcpSegment,
      eq(gtmOutreachCampaign.icpSegmentId, gtmIcpSegment.id)
    )
    .where(eq(gtmResearchRun.organizationId, organizationId))
    .orderBy(desc(gtmOutreachCampaign.createdAt))
  return rows.map((row) => ({
    campaign: publicPipelineRow(row.campaign),
    researchRun: publicPipelineRow(row.researchRun),
    segmentName: row.segmentName,
    stats: {
      drafts: row.draftCount,
      sent: row.sentCount,
      replies: row.replyCount,
    },
  }))
}

/** Vendor identifiers never leave the server: customers must not see which data vendor was used. */
// leadSearchState holds the search's internal queue (people not yet tried).
const VENDOR_FIELDS: readonly string[] = [
  "source",
  "providerId",
  "providerPersonId",
  "leadSearchState",
]

function withoutVendorFields<T extends { source: unknown }>(row: T) {
  return Object.fromEntries(
    Object.entries(row).filter(([key]) => !VENDOR_FIELDS.includes(key))
  ) as Omit<T, "source" | "providerId" | "providerPersonId" | "leadSearchState">
}

/**
 * Campaign header data plus its prospect companies, their usable contacts
 * (mailbox-verified, not rejected, not bounced), a neutral list of the people
 * that were skipped, the lead counts, metric snapshots and raw draft rows.
 * Returns null when the campaign does not belong to the organization (IDOR guard).
 */
export async function getCampaignDetail(
  campaignId: string,
  organizationId: string
) {
  const access = await verifyCampaignAccess(campaignId, organizationId)
  if (!access) return null
  const verified = {
    ...access,
    campaign: publicPipelineRow(access.campaign),
    researchRun: publicPipelineRow(access.researchRun),
  }

  const rows = await db
    .select()
    .from(gtmProspectCompany)
    .where(eq(gtmProspectCompany.outreachCampaignId, campaignId))
    // Best fit first (database mode); legacy rows have no score and keep their order.
    .orderBy(
      sql`${gtmProspectCompany.fitScore} DESC NULLS LAST`,
      gtmProspectCompany.createdAt
    )
  const companies = rows.map(withoutVendorFields)
  const discovery = {
    usesCompanyDatabase:
      access.campaign.currentStage === "awaiting_company_selection" ||
      rows.some((c) => c.source !== "web_search"),
    decisionMakersPerCompany: getDecisionMakersPerCompany(),
  }

  const companyIds = companies.map((c) => c.id)

  if (companyIds.length === 0) {
    return {
      ...verified,
      ...discovery,
      companies,
      snapshots: [],
      contacts: [],
      skippedContacts: [],
      leadSummary: { reviewed: 0, verified: 0 },
      drafts: [],
    }
  }

  const [snapshots, allContacts, drafts] = await Promise.all([
    db
      .select()
      .from(gtmCompanyMetricSnapshot)
      .where(inArray(gtmCompanyMetricSnapshot.prospectCompanyId, companyIds)),
    db
      .select()
      .from(gtmContact)
      .where(inArray(gtmContact.prospectCompanyId, companyIds)),
    db
      .select({
        ...getTableColumns(gtmEmailDraft),
        hasBounced: sql<boolean>`EXISTS (SELECT 1 FROM gtm_email_event e WHERE e.email_draft_id = ${gtmEmailDraft.id} AND e.type = 'bounced')`,
      })
      .from(gtmEmailDraft)
      .where(eq(gtmEmailDraft.outreachCampaignId, campaignId)),
  ])

  const contacts = []
  const skippedContacts = []
  for (const contact of allContacts) {
    const reason = skippedReason(contact, drafts)
    if (!reason) {
      contacts.push(publicContactRow(contact))
      continue
    }
    skippedContacts.push({
      id: contact.id,
      name: contact.name,
      title: contact.title,
      companyName:
        rows.find((c) => c.id === contact.prospectCompanyId)?.name ?? "",
      reason,
    })
  }
  const leadSummary = {
    reviewed: allContacts.length,
    verified: contacts.length,
  }

  return {
    ...verified,
    ...discovery,
    companies,
    snapshots,
    contacts,
    skippedContacts,
    leadSummary,
    drafts,
  }
}

/**
 * Drafts for a campaign with the contact and company each one targets, newest
 * first: only drafts of usable leads (mailbox-verified, not rejected, never
 * bounced); the rest are counted in the campaign's Skipped section. Callers must
 * verify campaign access before calling.
 */
export async function listCampaignDrafts(campaignId: string) {
  const rows = await db
    .select({
      id: gtmEmailDraft.id,
      subject: gtmEmailDraft.subject,
      body: gtmEmailDraft.body,
      status: gtmEmailDraft.status,
      providerMessageId: gtmEmailDraft.providerMessageId,
      sentAt: gtmEmailDraft.sentAt,
      errorMessage: gtmEmailDraft.errorMessage,
      hasBounced: sql<boolean>`EXISTS (SELECT 1 FROM gtm_email_event e WHERE e.email_draft_id = ${gtmEmailDraft.id} AND e.type = 'bounced')`,
      createdAt: gtmEmailDraft.createdAt,
      reviewedBy: gtmEmailDraft.reviewedBy,
      reviewedAt: gtmEmailDraft.reviewedAt,
      contact: {
        id: gtmContact.id,
        name: gtmContact.name,
        title: gtmContact.title,
        email: gtmContact.email,
        emailSource: gtmContact.emailSource,
        verificationStatus: gtmContact.verificationStatus,
        linkedinUrl: gtmContact.linkedinUrl,
      },
      company: {
        id: gtmProspectCompany.id,
        name: gtmProspectCompany.name,
        domain: gtmProspectCompany.domain,
        location: gtmProspectCompany.location,
      },
    })
    .from(gtmEmailDraft)
    .innerJoin(gtmContact, eq(gtmEmailDraft.contactId, gtmContact.id))
    .innerJoin(
      gtmProspectCompany,
      eq(gtmContact.prospectCompanyId, gtmProspectCompany.id)
    )
    .where(and(eq(gtmEmailDraft.outreachCampaignId, campaignId), usableLeadSql))
    .orderBy(desc(gtmEmailDraft.createdAt))
  return rows.map((row) => ({
    ...row,
    contact: publicContactRow(row.contact),
  }))
}

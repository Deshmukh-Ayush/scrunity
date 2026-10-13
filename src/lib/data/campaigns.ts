import "server-only"

import { db } from "@/utils/db"
import {
  gtmCompanyMetricSnapshot,
  gtmContact,
  gtmEmailDraft,
  gtmOutreachCampaign,
  gtmProspectCompany,
  gtmResearchRun,
} from "@/db/schema"
import { desc, eq, inArray, sql } from "drizzle-orm"
import { verifyCampaignAccess } from "@/lib/gtm-auth"

/**
 * Every outreach campaign in the organization, newest first, joined with the
 * research run it came from. Backs GET /api/gtm/campaigns and the server-rendered
 * campaign lists.
 */
export async function listOrgCampaigns(organizationId: string) {
  return db
    .select({
      campaign: gtmOutreachCampaign,
      researchRun: gtmResearchRun,
    })
    .from(gtmOutreachCampaign)
    .innerJoin(
      gtmResearchRun,
      eq(gtmOutreachCampaign.researchRunId, gtmResearchRun.id)
    )
    .where(eq(gtmResearchRun.organizationId, organizationId))
    .orderBy(desc(gtmOutreachCampaign.createdAt))
}

/**
 * Campaign header data plus its prospect companies, their contacts and metric
 * snapshots, and raw draft rows. Returns null when the campaign does not belong
 * to the organization (IDOR guard).
 */
export async function getCampaignDetail(
  campaignId: string,
  organizationId: string
) {
  const verified = await verifyCampaignAccess(campaignId, organizationId)
  if (!verified) return null

  const companies = await db
    .select()
    .from(gtmProspectCompany)
    .where(eq(gtmProspectCompany.outreachCampaignId, campaignId))

  const companyIds = companies.map((c) => c.id)

  if (companyIds.length === 0) {
    return { ...verified, companies, snapshots: [], contacts: [], drafts: [] }
  }

  const [snapshots, contacts, drafts] = await Promise.all([
    db
      .select()
      .from(gtmCompanyMetricSnapshot)
      .where(inArray(gtmCompanyMetricSnapshot.prospectCompanyId, companyIds)),
    db
      .select()
      .from(gtmContact)
      .where(inArray(gtmContact.prospectCompanyId, companyIds)),
    db
      .select()
      .from(gtmEmailDraft)
      .where(eq(gtmEmailDraft.outreachCampaignId, campaignId)),
  ])

  return { ...verified, companies, snapshots, contacts, drafts }
}

/**
 * Drafts for a campaign with the contact and company each one targets, newest
 * first. Callers must verify campaign access before calling.
 */
export async function listCampaignDrafts(campaignId: string) {
  return db
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
    .where(eq(gtmEmailDraft.outreachCampaignId, campaignId))
    .orderBy(desc(gtmEmailDraft.createdAt))
}

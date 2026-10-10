import * as React from "react";
import { getTenantContext } from "@/lib/tenant-context";
import { db } from "@/utils/db";
import {
  gtmContact,
  gtmProspectCompany,
  gtmOutreachCampaign,
  gtmIcpSegment,
  gtmResearchRun,
} from "@/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { LeadsTableClient, type Lead } from "./leads-table-client";

export async function LeadsSection({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const { organizationId } = await getTenantContext();

  if (!organizationId) {
    return <LeadsTableClient initialLeads={[]} initialTotal={0} initialCampaigns={[]} />;
  }

  const campaignIdParam = typeof searchParams?.campaignId === "string" ? searchParams.campaignId : "all";
  const statusParam = typeof searchParams?.status === "string" ? searchParams.status : "all";
  const searchParam = typeof searchParams?.search === "string" ? searchParams.search : "";
  const pageParam = Math.max(1, parseInt(typeof searchParams?.page === "string" ? searchParams.page : "1", 10) || 1);
  const pageSize = 20;

  // Campaigns for filter dropdown
  const campaigns = await db
    .select({
      id: gtmOutreachCampaign.id,
      name: gtmIcpSegment.name,
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
    .where(eq(gtmResearchRun.organizationId, organizationId))
    .orderBy(gtmIcpSegment.name);

  // Status computation SQL
  const statusSql = sql<string>`
    CASE
      WHEN EXISTS (
        SELECT 1 FROM gtm_meeting m 
        WHERE m.contact_id = ${gtmContact.id} AND m.status IN ('booked', 'completed')
      ) THEN 'meeting_booked'
      WHEN EXISTS (
        SELECT 1 FROM gtm_email_draft d 
        JOIN gtm_email_event e ON e.email_draft_id = d.id 
        WHERE d.contact_id = gtm_contact.id AND e.type = 'replied'
      ) THEN 'replied'
      WHEN EXISTS (
        SELECT 1 FROM gtm_email_draft d 
        JOIN gtm_email_event e ON e.email_draft_id = d.id 
        WHERE d.contact_id = gtm_contact.id AND e.type = 'bounced'
      ) THEN 'bounced'
      WHEN EXISTS (
        SELECT 1 FROM gtm_email_draft d 
        WHERE d.contact_id = ${gtmContact.id} AND d.status = 'sent'
      ) THEN 'sent'
      WHEN EXISTS (
        SELECT 1 FROM gtm_email_draft d 
        WHERE d.contact_id = ${gtmContact.id} AND d.status = 'approved'
      ) THEN 'approved'
      WHEN EXISTS (
        SELECT 1 FROM gtm_email_draft d 
        WHERE d.contact_id = ${gtmContact.id} AND d.status = 'rejected'
      ) THEN 'disqualified'
      WHEN EXISTS (
        SELECT 1 FROM gtm_email_draft d 
        WHERE d.contact_id = ${gtmContact.id} AND d.status = 'failed'
      ) THEN 'failed'
      WHEN EXISTS (
        SELECT 1 FROM gtm_email_draft d 
        WHERE d.contact_id = ${gtmContact.id} AND d.status = 'draft'
      ) THEN 'drafted'
      ELSE 'discovered'
    END
  `;

  // Build filter conditions
  const conditions = [
    eq(gtmResearchRun.organizationId, organizationId),
  ];

  if (campaignIdParam && campaignIdParam !== "all") {
    conditions.push(eq(gtmOutreachCampaign.id, campaignIdParam));
  }

  if (statusParam && statusParam !== "all") {
    conditions.push(sql`(${statusSql}) = ${statusParam}`);
  }

  if (searchParam && searchParam.trim() !== "") {
    const term = `%${searchParam.trim().toLowerCase()}%`;
    conditions.push(
      sql`(
        LOWER(${gtmContact.name}) LIKE ${term} OR
        LOWER(${gtmContact.title}) LIKE ${term} OR
        LOWER(COALESCE(${gtmContact.email}, '')) LIKE ${term} OR
        LOWER(${gtmProspectCompany.name}) LIKE ${term}
      )`
    );
  }

  // Total count
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(gtmContact)
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
    .where(and(...conditions));

  const total = Number(countResult?.count || 0);
  const offset = (pageParam - 1) * pageSize;

  // Initial page leads
  const leadsRaw = await db
    .select({
      id: gtmContact.id,
      name: gtmContact.name,
      title: gtmContact.title,
      email: gtmContact.email,
      verificationStatus: gtmContact.verificationStatus,
      emailSource: gtmContact.emailSource,
      linkedinUrl: gtmContact.linkedinUrl,
      createdAt: gtmContact.createdAt,
      companyId: gtmProspectCompany.id,
      companyName: gtmProspectCompany.name,
      companyDomain: gtmProspectCompany.domain,
      campaignId: gtmOutreachCampaign.id,
      campaignName: gtmIcpSegment.name,
      status: statusSql,
      draftId: sql<string | null>`(SELECT id FROM gtm_email_draft WHERE contact_id = ${gtmContact.id} ORDER BY created_at DESC LIMIT 1)`,
      draftSubject: sql<string | null>`(SELECT subject FROM gtm_email_draft WHERE contact_id = ${gtmContact.id} ORDER BY created_at DESC LIMIT 1)`,
      draftBody: sql<string | null>`(SELECT body FROM gtm_email_draft WHERE contact_id = ${gtmContact.id} ORDER BY created_at DESC LIMIT 1)`,
      draftStatus: sql<string | null>`(SELECT status FROM gtm_email_draft WHERE contact_id = ${gtmContact.id} ORDER BY created_at DESC LIMIT 1)`,
      threadId: sql<string | null>`(SELECT COALESCE(thread_id, id) FROM gtm_email_draft WHERE contact_id = ${gtmContact.id} AND (status = 'sent' OR status = 'failed') ORDER BY COALESCE(sent_at, created_at) DESC LIMIT 1)`,
      rejectionReason: sql<string | null>`(SELECT error_message FROM gtm_email_draft WHERE contact_id = ${gtmContact.id} AND error_message IS NOT NULL ORDER BY created_at DESC LIMIT 1)`,
    })
    .from(gtmContact)
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
    .innerJoin(
      gtmIcpSegment,
      eq(gtmOutreachCampaign.icpSegmentId, gtmIcpSegment.id)
    )
    .where(and(...conditions))
    .orderBy(desc(gtmContact.createdAt))
    .limit(pageSize)
    .offset(offset);

  const leads: Lead[] = leadsRaw.map((l) => ({
    ...l,
    createdAt: l.createdAt.toISOString(),
  }));

  return (
    <LeadsTableClient
      initialLeads={leads}
      initialTotal={total}
      initialCampaigns={campaigns}
      initialCampaignId={campaignIdParam}
      initialStatus={statusParam}
      initialSearch={searchParam}
      initialPage={pageParam}
    />
  );
}

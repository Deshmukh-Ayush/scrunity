import { NextRequest, NextResponse } from "next/server";
import { db } from "@/utils/db";
import {
  gtmContact,
  gtmProspectCompany,
  gtmOutreachCampaign,
  gtmIcpSegment,
  gtmResearchRun,
} from "@/db/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { resolveAuthAndOrg } from "@/lib/gtm-auth";

export async function GET(req: NextRequest) {
  try {
    const reqHeaders = req.headers;
    const { auth, error, status } = await resolveAuthAndOrg(reqHeaders);

    if (error || !auth) {
      return NextResponse.json({ error: error || "Unauthorized" }, { status: status || 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10) || 20));
    const campaignId = searchParams.get("campaignId");
    const statusFilter = searchParams.get("status");
    const search = searchParams.get("search");

    // Fetch campaigns for current org for dropdown filter
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
      .where(eq(gtmResearchRun.organizationId, auth.orgId))
      .orderBy(gtmIcpSegment.name);

    // Dynamic contact status computation
    const statusSql = sql<string>`
      CASE
        WHEN EXISTS (
          SELECT 1 FROM gtm_meeting m 
          WHERE m.contact_id = ${gtmContact.id} AND m.status IN ('booked', 'completed')
        ) THEN 'meeting_booked'
        WHEN EXISTS (
          SELECT 1 FROM gtm_email_draft d 
          JOIN gtm_email_event e ON e.email_draft_id = d.id 
          WHERE d.contact_id = ${gtmContact.id} AND e.type = 'replied'
        ) THEN 'replied'
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
      eq(gtmResearchRun.organizationId, auth.orgId),
    ];

    if (campaignId && campaignId !== "all") {
      conditions.push(eq(gtmOutreachCampaign.id, campaignId));
    }

    if (statusFilter && statusFilter !== "all") {
      conditions.push(sql`(${statusSql}) = ${statusFilter}`);
    }

    if (search && search.trim() !== "") {
      const term = `%${search.trim().toLowerCase()}%`;
      conditions.push(
        sql`(
          LOWER(${gtmContact.name}) LIKE ${term} OR
          LOWER(${gtmContact.title}) LIKE ${term} OR
          LOWER(COALESCE(${gtmContact.email}, '')) LIKE ${term} OR
          LOWER(${gtmProspectCompany.name}) LIKE ${term}
        )`
      );
    }

    // Total count for pagination
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
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const offset = (page - 1) * pageSize;

    // Paginated leads query
    const leads = await db
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
        threadId: sql<string | null>`(SELECT COALESCE(thread_id, id) FROM gtm_email_draft WHERE contact_id = ${gtmContact.id} AND status = 'sent' ORDER BY sent_at DESC LIMIT 1)`,
        rejectionReason: sql<string | null>`(SELECT COALESCE(error_message, 'Rejected during review') FROM gtm_email_draft WHERE contact_id = ${gtmContact.id} AND status = 'rejected' ORDER BY created_at DESC LIMIT 1)`,
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

    return NextResponse.json({
      success: true,
      leads,
      total,
      page,
      pageSize,
      totalPages,
      campaigns,
    });
  } catch (err: any) {
    console.error("[GET /api/gtm/leads] Error:", err);
    return NextResponse.json(
      { error: "Internal server error", message: err.message },
      { status: 500 }
    );
  }
}

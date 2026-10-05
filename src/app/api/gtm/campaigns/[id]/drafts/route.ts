import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/utils/db";
import { gtmEmailDraft, gtmContact, gtmProspectCompany } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { resolveAuthAndOrg, verifyCampaignAccess } from "@/lib/gtm-auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const reqHeaders = await headers();
    const { auth, error, status } = await resolveAuthAndOrg(reqHeaders);

    if (error || !auth) {
      return NextResponse.json({ error }, { status });
    }

    // IDOR protection: Verify caller's org owns this campaign
    const verified = await verifyCampaignAccess(id, auth.orgId);
    if (!verified) {
      return NextResponse.json(
        { error: "Forbidden: Campaign not found or unauthorized" },
        { status: 403 }
      );
    }

    // Fetch drafts with contact and company info
    const drafts = await db
      .select({
        id: gtmEmailDraft.id,
        subject: gtmEmailDraft.subject,
        body: gtmEmailDraft.body,
        status: gtmEmailDraft.status,
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
      .where(eq(gtmEmailDraft.outreachCampaignId, id))
      .orderBy(desc(gtmEmailDraft.createdAt));

    return NextResponse.json({ success: true, drafts });
  } catch (err: any) {
    console.error("[GET /api/gtm/campaigns/[id]/drafts] Error:", err);
    return NextResponse.json(
      { error: "Internal server error", message: err.message },
      { status: 500 }
    );
  }
}

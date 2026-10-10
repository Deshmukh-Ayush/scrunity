import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/utils/db";
import { gtmEmailDraft, gtmContact, gtmProspectCompany } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
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

export async function POST(
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

    const verified = await verifyCampaignAccess(id, auth.orgId);
    if (!verified) {
      return NextResponse.json(
        { error: "Forbidden: Campaign not found or unauthorized" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    if (body.action === "approve_all") {
      const { and } = await import("drizzle-orm");
      await db
        .update(gtmEmailDraft)
        .set({
          status: "approved",
          reviewedBy: auth.userId,
          reviewedAt: new Date(),
        })
        .where(
          and(
            eq(gtmEmailDraft.outreachCampaignId, id),
            eq(gtmEmailDraft.status, "draft")
          )
        );

      return NextResponse.json({ success: true, message: "All drafts approved" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    console.error("[POST /api/gtm/campaigns/[id]/drafts] Error:", err);
    return NextResponse.json(
      { error: "Internal server error", message: err.message },
      { status: 500 }
    );
  }
}

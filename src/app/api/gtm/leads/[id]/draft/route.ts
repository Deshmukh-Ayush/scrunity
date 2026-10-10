import { NextRequest, NextResponse } from "next/server";
import { db } from "@/utils/db";
import {
  gtmContact,
  gtmProspectCompany,
  gtmOutreachCampaign,
  gtmIcpSegment,
  gtmResearchRun,
  gtmEmailDraft,
} from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { resolveAuthAndOrg } from "@/lib/gtm-auth";
import { generateOutreachEmailDraft } from "@/lib/gtm-ai";
import { isValidPersonName } from "@/lib/gtm-contact-matcher";
import { checkLeadQualificationGates } from "@/lib/gtm-stage-5-5";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: contactId } = await params;
    const reqHeaders = req.headers;
    const { auth, error, status } = await resolveAuthAndOrg(reqHeaders);

    if (error || !auth) {
      return NextResponse.json({ error: error || "Unauthorized" }, { status: status || 401 });
    }

    // 1. Fetch contact, company, campaign, segment, and researchRun (with org validation)
    const [context] = await db
      .select({
        contact: gtmContact,
        company: gtmProspectCompany,
        campaign: gtmOutreachCampaign,
        segment: gtmIcpSegment,
        researchRun: gtmResearchRun,
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
        gtmIcpSegment,
        eq(gtmOutreachCampaign.icpSegmentId, gtmIcpSegment.id)
      )
      .innerJoin(
        gtmResearchRun,
        eq(gtmOutreachCampaign.researchRunId, gtmResearchRun.id)
      )
      .where(
        and(
          eq(gtmContact.id, contactId),
          eq(gtmResearchRun.organizationId, auth.orgId)
        )
      );

    if (!context) {
      return NextResponse.json(
        { error: "Contact not found or access denied" },
        { status: 404 }
      );
    }

    const { contact, company, campaign, segment, researchRun } = context;

    // HARD SAFETY GUARDRAIL: Reject drafting for structurally invalid contact names (e.g. role titles)
    if (!isValidPersonName(contact.name)) {
      return NextResponse.json(
        {
          error: `Cannot draft email: Contact name "${contact.name}" is a job title or invalid entity. Pending re-discovery.`,
          code: "INVALID_CONTACT_NAME",
        },
        { status: 422 }
      );
    }

    // HARD QUALIFICATION GATES: Email confidence floor and LinkedIn profile required
    const gateCheck = checkLeadQualificationGates(contact);
    if (!gateCheck.qualified) {
      return NextResponse.json(
        {
          error: `Cannot draft email: ${gateCheck.reason}.`,
          code: "GATE_DISQUALIFIED",
        },
        { status: 422 }
      );
    }
    const [existingDraft] = await db
      .select()
      .from(gtmEmailDraft)
      .where(eq(gtmEmailDraft.contactId, contactId))
      .orderBy(desc(gtmEmailDraft.createdAt));

    if (existingDraft) {
      return NextResponse.json({
        success: true,
        draft: existingDraft,
        alreadyExisted: true,
      });
    }

    // 3. Generate draft using existing stage 6 AI drafting logic
    const generated = await generateOutreachEmailDraft({
      contactName: contact.name,
      contactTitle: contact.title,
      companyName: company.name,
      companyDescription: company.description,
      segmentPainPoint: segment.painPoint,
      senderCompanyName: researchRun.companyName,
      senderCompanyDescription: researchRun.companyDescription,
    });

    // 4. Insert draft
    const [newDraft] = await db
      .insert(gtmEmailDraft)
      .values({
        contactId: contact.id,
        outreachCampaignId: campaign.id,
        subject: generated.subject,
        body: generated.body,
        status: "draft",
      })
      .returning();

    return NextResponse.json({
      success: true,
      draft: newDraft,
    });
  } catch (err: unknown) {
    console.error("[POST /api/gtm/leads/[id]/draft] Error:", err);
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

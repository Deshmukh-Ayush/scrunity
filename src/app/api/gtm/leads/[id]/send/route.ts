import { NextRequest, NextResponse } from "next/server";
import { db } from "@/utils/db";
import {
  gtmContact,
  gtmProspectCompany,
  gtmOutreachCampaign,
  gtmResearchRun,
  gtmEmailDraft,
  gtmConnectedMailbox,
} from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { resolveAuthAndOrg } from "@/lib/gtm-auth";
import { executeSendEmails } from "@/inngest/functions/send-emails";
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

    const body = await req.json().catch(() => ({}));

    // 1. Fetch contact, campaign, and verify organization access
    const [context] = await db
      .select({
        contact: gtmContact,
        company: gtmProspectCompany,
        campaign: gtmOutreachCampaign,
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

    // HARD SAFETY GUARDRAIL: Reject sending for structurally invalid contact names (e.g. role titles)
    if (!isValidPersonName(context.contact.name)) {
      return NextResponse.json(
        {
          error: `Cannot send email: Contact name "${context.contact.name}" is a job title or invalid entity. Pending re-discovery.`,
          code: "INVALID_CONTACT_NAME",
        },
        { status: 422 }
      );
    }

    // HARD QUALIFICATION GATES: Email confidence floor and LinkedIn profile required
    const gateCheck = checkLeadQualificationGates(context.contact);
    if (!gateCheck.qualified) {
      return NextResponse.json(
        {
          error: `Cannot send email: ${gateCheck.reason}.`,
          code: "GATE_DISQUALIFIED",
        },
        { status: 422 }
      );
    }

    // 2. Fetch the draft for this contact
    let [draft] = await db
      .select()
      .from(gtmEmailDraft)
      .where(eq(gtmEmailDraft.contactId, contactId))
      .orderBy(desc(gtmEmailDraft.createdAt));

    if (!draft) {
      return NextResponse.json(
        { error: "No email draft found for this contact. Generate a draft first." },
        { status: 400 }
      );
    }

    // 3. If approveFirst requested or edits provided, approve draft before sending
    if (body.approveFirst || body.edits || draft.status !== "approved") {
      const updateFields: Record<string, unknown> = {
        status: "approved",
        reviewedBy: auth.userId,
        reviewedAt: new Date(),
      };
      if (body.edits?.subject) {
        updateFields.subject = body.edits.subject;
      }
      if (body.edits?.body) {
        updateFields.body = body.edits.body;
      }

      const [updatedDraft] = await db
        .update(gtmEmailDraft)
        .set(updateFields)
        .where(eq(gtmEmailDraft.id, draft.id))
        .returning();

      draft = updatedDraft;
    }

    // 4. Verify draft is now approved (HARD SAFETY CHECK)
    if (draft.status !== "approved") {
      return NextResponse.json(
        { error: "Draft must be approved before dispatching via Gmail." },
        { status: 400 }
      );
    }

    // 5. Check connected mailbox
    const [mailbox] = await db
      .select()
      .from(gtmConnectedMailbox)
      .where(
        and(
          eq(gtmConnectedMailbox.organizationId, auth.orgId),
          eq(gtmConnectedMailbox.status, "connected")
        )
      );

    if (!mailbox) {
      return NextResponse.json(
        { error: "No connected Gmail mailbox found. Please connect your Gmail mailbox in Settings." },
        { status: 400 }
      );
    }

    // 6. Execute send through the existing stage 7 Gmail pipeline
    const sendResult = await executeSendEmails({
      outreachCampaignId: context.campaign.id,
      draftId: draft.id,
    });

    if (sendResult.sentCount === 0) {
      if (sendResult.stoppedAtCap) {
        return NextResponse.json(
          { error: "Daily send cap reached for your mailbox." },
          { status: 429 }
        );
      }
      if (sendResult.stoppedAtCredits) {
        return NextResponse.json(
          { error: "AI credits exhausted. Please top up credits to send outreach." },
          { status: 402 }
        );
      }
      return NextResponse.json(
        { error: "Failed to dispatch email draft." },
        { status: 500 }
      );
    }

    // Fetch fresh draft state
    const [freshDraft] = await db
      .select()
      .from(gtmEmailDraft)
      .where(eq(gtmEmailDraft.id, draft.id));

    return NextResponse.json({
      success: true,
      messageId: sendResult.messageIds[0],
      draft: freshDraft,
    });
  } catch (err: unknown) {
    console.error("[POST /api/gtm/leads/[id]/send] Error:", err);
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

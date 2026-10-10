import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/utils/db";
import {
  gtmConnectedMailbox,
  gtmEmailDraft,
  gtmOutreachCampaign,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveAuthAndOrg, verifyCampaignAccess } from "@/lib/gtm-auth";
import { inngest } from "@/inngest/client";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;
    const reqHeaders = await headers();
    const { auth, error, status } = await resolveAuthAndOrg(reqHeaders);

    if (error || !auth) {
      return NextResponse.json({ error }, { status });
    }

    // Verify campaign belongs to caller's org (IDOR protection)
    const verified = await verifyCampaignAccess(campaignId, auth.orgId);
    if (!verified) {
      return NextResponse.json(
        { error: "Forbidden: Campaign not found or unauthorized" },
        { status: 403 }
      );
    }

    // 1. Check mailbox connection
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
        {
          error:
            "No connected Gmail mailbox found. Please connect your Gmail mailbox before sending outreach emails.",
        },
        { status: 400 }
      );
    }

    // 2. Check AI credit availability upfront (Step 5)
    const { hasAvailableCredits } = await import("@/lib/gtm-ai-credits");
    const hasCredits = await hasAvailableCredits(auth.orgId);
    if (!hasCredits) {
      return NextResponse.json(
        {
          error:
            "AI credits exhausted (0 remaining). Please top up credits or upgrade your plan on the Billing page to start email dispatch.",
          creditsExhausted: true,
        },
        { status: 402 }
      );
    }

    // 3. Check for approved drafts
    const approvedDrafts = await db
      .select({ id: gtmEmailDraft.id })
      .from(gtmEmailDraft)
      .where(
        and(
          eq(gtmEmailDraft.outreachCampaignId, campaignId),
          eq(gtmEmailDraft.status, "approved")
        )
      );

    if (approvedDrafts.length === 0) {
      return NextResponse.json(
        {
          error:
            "No approved email drafts found. You must approve at least one draft before starting the campaign dispatch.",
        },
        { status: 400 }
      );
    }

    // 3. Update campaign stage & fire Inngest event
    await db
      .update(gtmOutreachCampaign)
      .set({
        currentStage: "send_emails",
        status: "in_progress",
      })
      .where(eq(gtmOutreachCampaign.id, campaignId));

    await inngest.send({
      name: "gtm/campaign.send_emails",
      data: {
        outreachCampaignId: campaignId,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Initiated sending of ${approvedDrafts.length} approved outreach email(s)`,
      approvedCount: approvedDrafts.length,
      mailboxEmail: mailbox.email,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[POST /api/gtm/campaigns/[id]/send] Error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/utils/db";
import {
  gtmOutreachCampaign,
  gtmProspectCompany,
  gtmEmailDraft,
} from "@/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { resolveAuthAndOrg, verifyCampaignAccess } from "@/lib/gtm-auth";
import { inngest } from "@/inngest/client";
import { runFullCampaignPipeline } from "@/lib/gtm-pipeline-runner";

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

    // Step 1: Atomic conditional check-and-set - only set in_progress if NOT already in_progress
    const [updatedCampaign] = await db
      .update(gtmOutreachCampaign)
      .set({
        currentStage: "find_companies",
        status: "in_progress",
        failureReason: null,
      })
      .where(
        and(
          eq(gtmOutreachCampaign.id, campaignId),
          ne(gtmOutreachCampaign.status, "in_progress")
        )
      )
      .returning();

    if (!updatedCampaign) {
      console.log(
        `[POST /api/gtm/campaigns/[id]/rerun] Duplicate rerun prevented: campaign ${campaignId} is already in_progress.`
      );
      return NextResponse.json(
        {
          error: "Campaign is currently in progress",
          duplicatePrevented: true,
        },
        { status: 409 }
      );
    }

    // Reset drafts and companies now that rerun is confirmed
    await Promise.all([
      db
        .delete(gtmEmailDraft)
        .where(eq(gtmEmailDraft.outreachCampaignId, campaignId)),
      db
        .delete(gtmProspectCompany)
        .where(eq(gtmProspectCompany.outreachCampaignId, campaignId)),
    ]);

    // Fire Inngest stage 4 event
    try {
      await inngest.send({
        name: "gtm/campaign.find_companies",
        data: {
          outreachCampaignId: campaignId,
        },
      });
    } catch (e) {
      console.warn("[POST /api/gtm/campaigns/[id]/rerun] inngest.send notice:", e);
    }

    // Direct background execution guarantees completion in all environments
    setImmediate(() => {
      runFullCampaignPipeline(campaignId).catch((err) => {
        console.error("[POST /api/gtm/campaigns/[id]/rerun] Background pipeline error:", err);
      });
    });

    return NextResponse.json({
      success: true,
      message: "Campaign pipeline restarted successfully",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    console.error("[POST /api/gtm/campaigns/[id]/rerun] Error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

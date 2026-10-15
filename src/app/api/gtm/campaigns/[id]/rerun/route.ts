import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/utils/db";
import {
  gtmOutreachCampaign,
  gtmProspectCompany,
  gtmEmailDraft,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { resolveAuthAndOrg, verifyCampaignAccess } from "@/lib/gtm-auth";
import { dispatchCampaign } from "@/lib/pipeline/dispatch";
import { campaignIsIdle } from "@/lib/pipeline/stage-state";
import { checkCampaignProviders } from "@/lib/pipeline/provider-check";

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

    // A missing provider is refused before anything is reset or spent.
    const providers = checkCampaignProviders();
    if (!providers.ok) {
      return NextResponse.json(
        { error: providers.message, providerUnavailable: true },
        { status: 503 }
      );
    }

    // Step 1: Atomic check-and-set. Allowed unless a live executor is still
    // working on the campaign (in_progress with a fresh heartbeat), which is
    // what lets a stalled campaign be retried without ever running it twice.
    const whereCondition = and(eq(gtmOutreachCampaign.id, campaignId), campaignIsIdle());

    const [updatedCampaign] = await db
      .update(gtmOutreachCampaign)
      .set({
        currentStage: "find_companies",
        status: "in_progress",
        failureReason: null,
        discoveryNote: null,
        searchFilters: null,
        leadSearchState: null,
        stageStartedAt: new Date(),
        lastProgressAt: null,
      })
      .where(whereCondition)
      .returning();

    if (!updatedCampaign) {
      console.log(
        `[POST /api/gtm/campaigns/[id]/rerun] Duplicate rerun prevented: campaign ${campaignId} is already in_progress.`
      );
      return NextResponse.json(
        {
          error: "Campaign is still actively running. Try again once it finishes or stalls.",
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

    await dispatchCampaign(campaignId);

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

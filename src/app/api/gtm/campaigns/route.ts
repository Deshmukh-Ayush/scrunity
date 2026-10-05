import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/utils/db";
import { gtmOutreachCampaign, gtmResearchRun } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { resolveAuthAndOrg, verifyIcpSegmentAccess } from "@/lib/gtm-auth";
import { inngest } from "@/inngest/client";
import { z } from "zod";

const createCampaignSchema = z.object({
  icpSegmentId: z.string().min(1, "ICP segment ID is required"),
});

export async function POST(req: NextRequest) {
  try {
    const reqHeaders = await headers();
    const { auth, error, status } = await resolveAuthAndOrg(reqHeaders);

    if (error || !auth) {
      return NextResponse.json({ error }, { status });
    }

    const body = await req.json();
    const parsed = createCampaignSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request payload", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { icpSegmentId } = parsed.data;

    // IDOR protection: Verify segment belongs to caller's org
    const verified = await verifyIcpSegmentAccess(icpSegmentId, auth.orgId);
    if (!verified) {
      return NextResponse.json(
        { error: "Forbidden: Segment not found or unauthorized" },
        { status: 403 }
      );
    }

    // Create campaign row
    const [campaign] = await db
      .insert(gtmOutreachCampaign)
      .values({
        icpSegmentId,
        researchRunId: verified.researchRun.id,
        status: "in_progress",
        currentStage: "find_companies",
      })
      .returning();

    // Fire Inngest event for this specific campaign run (concurrent and keyed by outreachCampaignId)
    await inngest.send({
      name: "gtm/campaign.find_companies",
      data: {
        outreachCampaignId: campaign.id,
      },
    });

    return NextResponse.json(
      { success: true, campaign },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("[POST /api/gtm/campaigns] Error:", err);
    return NextResponse.json(
      { error: "Internal server error", message: err.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const reqHeaders = await headers();
    const { auth, error, status } = await resolveAuthAndOrg(reqHeaders);

    if (error || !auth) {
      return NextResponse.json({ error }, { status });
    }

    const campaigns = await db
      .select({
        campaign: gtmOutreachCampaign,
        researchRun: gtmResearchRun,
      })
      .from(gtmOutreachCampaign)
      .innerJoin(
        gtmResearchRun,
        eq(gtmOutreachCampaign.researchRunId, gtmResearchRun.id)
      )
      .where(eq(gtmResearchRun.organizationId, auth.orgId))
      .orderBy(desc(gtmOutreachCampaign.createdAt));

    return NextResponse.json({ success: true, campaigns });
  } catch (err: any) {
    console.error("[GET /api/gtm/campaigns] Error:", err);
    return NextResponse.json(
      { error: "Internal server error", message: err.message },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/utils/db";
import { gtmCompetitor, gtmIcpSegment, gtmOutreachCampaign } from "@/db/schema";
import { eq } from "drizzle-orm";
import { resolveAuthAndOrg, verifyResearchRunAccess } from "@/lib/gtm-auth";

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

    // IDOR protection: Verify caller's org owns this research run
    const run = await verifyResearchRunAccess(id, auth.orgId);
    if (!run) {
      return NextResponse.json(
        { error: "Forbidden: Research run not found or unauthorized" },
        { status: 403 }
      );
    }

    // Fetch competitors, segments, and in-flight campaigns
    const [competitors, segments, campaigns] = await Promise.all([
      db
        .select()
        .from(gtmCompetitor)
        .where(eq(gtmCompetitor.researchRunId, id)),
      db
        .select()
        .from(gtmIcpSegment)
        .where(eq(gtmIcpSegment.researchRunId, id)),
      db
        .select()
        .from(gtmOutreachCampaign)
        .where(eq(gtmOutreachCampaign.researchRunId, id)),
    ]);

    return NextResponse.json({
      success: true,
      researchRun: run,
      competitors,
      segments,
      campaigns,
    });
  } catch (err: any) {
    console.error("[GET /api/gtm/research-runs/[id]] Error:", err);
    return NextResponse.json(
      { error: "Internal server error", message: err.message },
      { status: 500 }
    );
  }
}

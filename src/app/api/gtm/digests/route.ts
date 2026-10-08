import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { resolveAuthAndOrg } from "@/lib/gtm-auth";
import { db } from "@/utils/db";
import { gtmSegmentDigest, gtmIcpSegment, gtmResearchRun } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

/**
 * GET /api/gtm/digests
 * Returns all generated segment digests for the authenticated organization.
 */
export async function GET(req: NextRequest) {
  try {
    const reqHeaders = await headers();
    const { auth, error, status } = await resolveAuthAndOrg(reqHeaders);

    if (error || !auth) {
      return NextResponse.json({ error }, { status });
    }

    const { searchParams } = new URL(req.url);
    const segmentId = searchParams.get("segmentId");

    const digestsQuery = db
      .select({
        digest: gtmSegmentDigest,
        segment: {
          id: gtmIcpSegment.id,
          name: gtmIcpSegment.name,
          painPoint: gtmIcpSegment.painPoint,
        },
        researchRun: {
          id: gtmResearchRun.id,
          companyName: gtmResearchRun.companyName,
        },
      })
      .from(gtmSegmentDigest)
      .innerJoin(
        gtmIcpSegment,
        eq(gtmSegmentDigest.icpSegmentId, gtmIcpSegment.id)
      )
      .innerJoin(
        gtmResearchRun,
        eq(gtmIcpSegment.researchRunId, gtmResearchRun.id)
      )
      .where(eq(gtmSegmentDigest.organizationId, auth.orgId))
      .orderBy(desc(gtmSegmentDigest.generatedAt));

    const allDigests = await digestsQuery;

    const filtered = segmentId
      ? allDigests.filter((d) => d.segment.id === segmentId)
      : allDigests;

    return NextResponse.json({
      success: true,
      digests: filtered,
    });
  } catch (err: any) {
    console.error("[GET /api/gtm/digests] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { resolveAuthAndOrg, verifyIcpSegmentAccess } from "@/lib/gtm-auth";
import {
  getLatestSegmentDigest,
  generateSegmentDigest,
  computeSegmentMetrics,
} from "@/lib/gtm-digest";

/**
 * GET /api/gtm/segments/[id]/digest
 * Returns the latest stored digest for a segment, or computes metrics if no digest exists yet.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: segmentId } = await params;
    const reqHeaders = await headers();
    const { auth, error, status } = await resolveAuthAndOrg(reqHeaders);

    if (error || !auth) {
      return NextResponse.json({ error }, { status });
    }

    // IDOR protection: verify caller has access to segment
    const verified = await verifyIcpSegmentAccess(segmentId, auth.orgId);
    if (!verified) {
      return NextResponse.json(
        { error: "Forbidden: Segment not found or unauthorized" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const autoGenerate = searchParams.get("autoGenerate") === "true";

    let digest = await getLatestSegmentDigest(segmentId);

    if (!digest && autoGenerate) {
      const generated = await generateSegmentDigest({ segmentId });
      digest = generated.digest;
    }

    if (!digest) {
      // Return live computed metrics even if a full stored digest hasn't been generated yet
      const computed = await computeSegmentMetrics({ segmentId });
      return NextResponse.json({
        success: true,
        digest: null,
        liveMetrics: computed.metrics,
        segment: {
          id: verified.segment.id,
          name: verified.segment.name,
          painPoint: verified.segment.painPoint,
        },
      });
    }

    return NextResponse.json({
      success: true,
      digest,
      segment: {
        id: verified.segment.id,
        name: verified.segment.name,
        painPoint: verified.segment.painPoint,
      },
    });
  } catch (err: any) {
    console.error("[GET /api/gtm/segments/[id]/digest] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/gtm/segments/[id]/digest
 * Re-runs computation and generates a fresh AI performance digest for the segment.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: segmentId } = await params;
    const reqHeaders = await headers();
    const { auth, error, status } = await resolveAuthAndOrg(reqHeaders);

    if (error || !auth) {
      return NextResponse.json({ error }, { status });
    }

    // IDOR protection
    const verified = await verifyIcpSegmentAccess(segmentId, auth.orgId);
    if (!verified) {
      return NextResponse.json(
        { error: "Forbidden: Segment not found or unauthorized" },
        { status: 403 }
      );
    }

    const generated = await generateSegmentDigest({ segmentId });

    return NextResponse.json({
      success: true,
      digest: generated.digest,
      structuredSummary: generated.structuredSummary,
      metrics: generated.computed.metrics,
    });
  } catch (err: any) {
    console.error("[POST /api/gtm/segments/[id]/digest] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

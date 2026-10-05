import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { resolveAuthAndOrg, verifyCampaignAccess } from "@/lib/gtm-auth";
import { inngest, outreachCampaignChannel } from "@/inngest/client";

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

    // IDOR verification: Ensure caller's org owns this campaign
    const verified = await verifyCampaignAccess(id, auth.orgId);
    if (!verified) {
      return NextResponse.json(
        { error: "Forbidden: Campaign not found or unauthorized" },
        { status: 403 }
      );
    }

    const channel = outreachCampaignChannel(id);

    try {
      if (process.env.INNGEST_SIGNING_KEY) {
        const token = await inngest.realtime.token({
          channel,
          topics: ["started", "completed", "failed"],
        });
        return NextResponse.json({
          success: true,
          channel: channel.name,
          token,
        });
      }
    } catch (realtimeErr) {
      console.warn(
        `[Realtime Token Notice] Inngest Cloud token retrieval: ${(realtimeErr as Error).message}`
      );
    }

    // Local / development fallback response
    return NextResponse.json({
      success: true,
      channel: channel.name,
      fallback: true,
      message:
        "Realtime channel allocated. Inngest signing key not configured in local environment.",
    });
  } catch (err: any) {
    console.error(
      "[GET /api/gtm/campaigns/[id]/realtime-token] Error:",
      err
    );
    return NextResponse.json(
      { error: "Internal server error", message: err.message },
      { status: 500 }
    );
  }
}

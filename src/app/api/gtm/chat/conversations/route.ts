import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/utils/db";
import {
  gtmConversation,
  gtmMessage,
  gtmOutreachCampaign,
  gtmResearchRun,
  gtmIcpSegment,
} from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { resolveAuthAndOrg, verifyCampaignAccess, verifyResearchRunAccess } from "@/lib/gtm-auth";
import { nanoid } from "nanoid";

export async function GET(req: NextRequest) {
  try {
    const reqHeaders = await headers();
    const { auth, error, status } = await resolveAuthAndOrg(reqHeaders);

    if (error || !auth) {
      return NextResponse.json({ error }, { status });
    }

    // Read-only: campaign threads are created with the campaign (POST /api/gtm/campaigns).
    // The campaign lookup (for sidebar labels) and the conversation list are independent.
    const [campaigns, allConvsWithMsgs] = await Promise.all([
      db
        .select({
          id: gtmOutreachCampaign.id,
          status: gtmOutreachCampaign.status,
          currentStage: gtmOutreachCampaign.currentStage,
          segmentName: gtmIcpSegment.name,
          companyName: gtmResearchRun.companyName,
        })
        .from(gtmOutreachCampaign)
        .innerJoin(gtmIcpSegment, eq(gtmOutreachCampaign.icpSegmentId, gtmIcpSegment.id))
        .innerJoin(gtmResearchRun, eq(gtmOutreachCampaign.researchRunId, gtmResearchRun.id))
        .where(eq(gtmResearchRun.organizationId, auth.orgId))
        .orderBy(desc(gtmOutreachCampaign.createdAt))
        .limit(20),
      // Only conversations that have at least one message
      db
        .select({
          id: gtmConversation.id,
          title: gtmConversation.title,
          outreachCampaignId: gtmConversation.outreachCampaignId,
          researchRunId: gtmConversation.researchRunId,
          createdAt: gtmConversation.createdAt,
          updatedAt: gtmConversation.updatedAt,
        })
        .from(gtmConversation)
        .where(
          and(
            eq(gtmConversation.organizationId, auth.orgId),
            sql`EXISTS (SELECT 1 FROM ${gtmMessage} WHERE ${gtmMessage.conversationId} = ${gtmConversation.id})`
          )
        )
        .orderBy(desc(gtmConversation.updatedAt))
        .limit(60),
    ]);

    const campaignMap = new Map(campaigns.map((c) => [c.id, c]));

    const conversations = allConvsWithMsgs.map((conv) => {
      const linkedCamp = conv.outreachCampaignId
        ? campaignMap.get(conv.outreachCampaignId)
        : null;

      return {
        id: conv.id,
        title: conv.title || "Untitled conversation",
        outreachCampaignId: conv.outreachCampaignId,
        researchRunId: conv.researchRunId,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        companyName: linkedCamp?.companyName || null,
        segmentName: linkedCamp?.segmentName || null,
        currentStage: linkedCamp?.currentStage || null,
        campaignStatus: linkedCamp?.status || null,
      };
    });

    return NextResponse.json({ conversations });
  } catch (err: any) {
    console.error("[GET /api/gtm/chat/conversations] Error:", err);
    return NextResponse.json(
      { error: "Internal server error", message: err.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const reqHeaders = await headers();
    const { auth, error, status } = await resolveAuthAndOrg(reqHeaders);

    if (error || !auth) {
      return NextResponse.json({ error }, { status });
    }

    const body = await req.json().catch(() => ({}));
    const { title, outreachCampaignId, researchRunId } = body;

    // A conversation may only link this organization's campaign or run.
    if (outreachCampaignId && !(await verifyCampaignAccess(String(outreachCampaignId), auth.orgId))) {
      return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
    }
    if (researchRunId && !(await verifyResearchRunAccess(String(researchRunId), auth.orgId))) {
      return NextResponse.json({ error: "Research run not found." }, { status: 404 });
    }

    const [conversation] = await db
      .insert(gtmConversation)
      .values({
        id: nanoid(),
        organizationId: auth.orgId,
        userId: auth.userId,
        title: title || "New conversation",
        outreachCampaignId: outreachCampaignId || null,
        researchRunId: researchRunId || null,
      })
      .returning();

    return NextResponse.json({ conversation }, { status: 201 });
  } catch (err: any) {
    console.error("[POST /api/gtm/chat/conversations] Error:", err);
    return NextResponse.json(
      { error: "Failed to create conversation", message: err.message },
      { status: 500 }
    );
  }
}

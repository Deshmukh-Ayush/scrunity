import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/utils/db";
import {
  gtmConversation,
  gtmOutreachCampaign,
  gtmResearchRun,
  gtmIcpSegment,
  gtmEmailDraft,
} from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { resolveAuthAndOrg } from "@/lib/gtm-auth";
import { nanoid } from "nanoid";

export async function GET(req: NextRequest) {
  try {
    const reqHeaders = await headers();
    const { auth, error, status } = await resolveAuthAndOrg(reqHeaders);

    if (error || !auth) {
      return NextResponse.json({ error }, { status });
    }

    // 1. Fetch campaigns in organization to ensure linked agent threads exist
    const campaigns = await db
      .select({
        id: gtmOutreachCampaign.id,
        status: gtmOutreachCampaign.status,
        currentStage: gtmOutreachCampaign.currentStage,
        failureReason: gtmOutreachCampaign.failureReason,
        createdAt: gtmOutreachCampaign.createdAt,
        segmentName: gtmIcpSegment.name,
        companyName: gtmResearchRun.companyName,
        researchRunId: gtmResearchRun.id,
      })
      .from(gtmOutreachCampaign)
      .innerJoin(
        gtmIcpSegment,
        eq(gtmOutreachCampaign.icpSegmentId, gtmIcpSegment.id)
      )
      .innerJoin(
        gtmResearchRun,
        eq(gtmOutreachCampaign.researchRunId, gtmResearchRun.id)
      )
      .where(eq(gtmResearchRun.organizationId, auth.orgId))
      .orderBy(desc(gtmOutreachCampaign.createdAt))
      .limit(20);

    // Existing conversations linked to campaigns
    const existingConvs = await db
      .select()
      .from(gtmConversation)
      .where(eq(gtmConversation.organizationId, auth.orgId));

    const convByCampaignId = new Map<string, (typeof existingConvs)[0]>();
    for (const c of existingConvs) {
      if (c.outreachCampaignId) {
        convByCampaignId.set(c.outreachCampaignId, c);
      }
    }

    // Auto-create conversation for any campaign that lacks one
    for (const camp of campaigns) {
      if (!convByCampaignId.has(camp.id)) {
        const [created] = await db
          .insert(gtmConversation)
          .values({
            id: nanoid(),
            organizationId: auth.orgId,
            userId: auth.userId,
            title: `${camp.companyName} — ${camp.segmentName}`,
            outreachCampaignId: camp.id,
            researchRunId: camp.researchRunId,
          })
          .returning();
        if (created) {
          convByCampaignId.set(camp.id, created);
        }
      }
    }

    // 2. Fetch all conversations in the organization in unified order (recency)
    const allConvs = await db
      .select()
      .from(gtmConversation)
      .where(eq(gtmConversation.organizationId, auth.orgId))
      .orderBy(desc(gtmConversation.updatedAt))
      .limit(60);

    const campaignMap = new Map(campaigns.map((c) => [c.id, c]));

    const conversations = allConvs.map((conv) => {
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

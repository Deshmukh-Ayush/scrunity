import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/utils/db";
import {
  gtmConversation,
  gtmMessage,
  gtmOutreachCampaign,
  gtmIcpSegment,
  gtmResearchRun,
} from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { resolveAuthAndOrg } from "@/lib/gtm-auth";

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

    const [conv] = await db
      .select()
      .from(gtmConversation)
      .where(
        and(
          eq(gtmConversation.id, id),
          eq(gtmConversation.organizationId, auth.orgId)
        )
      )
      .limit(1);

    if (!conv) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Load messages in chronological order
    const messages = await db
      .select()
      .from(gtmMessage)
      .where(eq(gtmMessage.conversationId, id))
      .orderBy(asc(gtmMessage.createdAt))
      .limit(100);

    // If linked to a campaign, enrich with campaign status
    let linkedCampaign = null;
    if (conv.outreachCampaignId) {
      const [camp] = await db
        .select({
          id: gtmOutreachCampaign.id,
          status: gtmOutreachCampaign.status,
          currentStage: gtmOutreachCampaign.currentStage,
          segmentName: gtmIcpSegment.name,
          companyName: gtmResearchRun.companyName,
          websiteUrl: gtmResearchRun.websiteUrl,
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
        .where(eq(gtmOutreachCampaign.id, conv.outreachCampaignId))
        .limit(1);
      linkedCampaign = camp || null;
    }

    return NextResponse.json({
      conversation: conv,
      linkedCampaign,
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        toolCalls: m.toolCalls || [],
        artifact: m.artifact || null,
        createdAt: m.createdAt,
      })),
    });
  } catch (err: any) {
    console.error("[GET /api/gtm/chat/conversations/[id]] Error:", err);
    return NextResponse.json(
      { error: "Internal server error", message: err.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    await db
      .delete(gtmConversation)
      .where(
        and(
          eq(gtmConversation.id, id),
          eq(gtmConversation.organizationId, auth.orgId)
        )
      );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[DELETE /api/gtm/chat/conversations/[id]] Error:", err);
    return NextResponse.json(
      { error: "Internal server error", message: err.message },
      { status: 500 }
    );
  }
}

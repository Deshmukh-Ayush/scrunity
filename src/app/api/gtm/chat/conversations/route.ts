import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/utils/db";
import {
  gtmConversation,
  gtmMessage,
  gtmOutreachCampaign,
  gtmResearchRun,
  gtmIcpSegment,
  gtmProspectCompany,
  gtmEmailDraft,
} from "@/db/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { resolveAuthAndOrg } from "@/lib/gtm-auth";
import { nanoid } from "nanoid";

export async function GET(req: NextRequest) {
  try {
    const reqHeaders = await headers();
    const { auth, error, status } = await resolveAuthAndOrg(reqHeaders);

    if (error || !auth) {
      return NextResponse.json({ error }, { status });
    }

    // 1. Fetch campaigns in organization to ensure linked threads are seeded
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

    // Auto-create and seed real message for any campaign that lacks one
    for (const camp of campaigns) {
      let conv = convByCampaignId.get(camp.id);
      if (!conv) {
        const [created] = await db
          .insert(gtmConversation)
          .values({
            id: nanoid(),
            organizationId: auth.orgId,
            userId: auth.userId,
            title: `${camp.companyName} — ${camp.segmentName}`,
            outreachCampaignId: camp.id,
            researchRunId: camp.researchRunId,
            createdAt: camp.createdAt,
            updatedAt: camp.createdAt,
          })
          .returning();
        conv = created;
        convByCampaignId.set(camp.id, created);
      }

      // Ensure a real seed message exists
      if (conv) {
        const [msgCount] = await db
          .select({ count: sql<number>`count(*)` })
          .from(gtmMessage)
          .where(eq(gtmMessage.conversationId, conv.id));

        if (Number(msgCount?.count || 0) === 0) {
          const prospects = await db
            .select({ id: gtmProspectCompany.id })
            .from(gtmProspectCompany)
            .where(eq(gtmProspectCompany.outreachCampaignId, camp.id));

          const drafts = await db
            .select({ id: gtmEmailDraft.id, status: gtmEmailDraft.status })
            .from(gtmEmailDraft)
            .where(eq(gtmEmailDraft.outreachCampaignId, camp.id));

          const pending = drafts.filter((d) => d.status === "draft").length;

          const content =
            `Autonomous GTM pipeline thread for **${camp.companyName}** targeting **${camp.segmentName}**.\n\n` +
            `- **Current Stage**: \`${camp.currentStage.replace(/_/g, " ")}\`\n` +
            `- **Pipeline Status**: \`${camp.status}\`\n` +
            `- **Discovered Prospects**: ${prospects.length} companies\n` +
            `- **Email Drafts**: ${drafts.length}${pending > 0 ? ` (${pending} pending review)` : ""}\n\n` +
            `Ask me to inspect discovered decision-makers, review email drafts, or advance pipeline execution.`;

          await db.insert(gtmMessage).values({
            id: nanoid(),
            conversationId: conv.id,
            role: "assistant",
            content,
            createdAt: camp.createdAt,
          });
        }
      }
    }

    // 2. Fetch only real conversations that have at least 1 message
    const allConvsWithMsgs = await db
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
      .limit(60);

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

import "server-only"

import { and, asc, eq } from "drizzle-orm"
import { db } from "@/utils/db"
import {
  gtmConversation,
  gtmIcpSegment,
  gtmMessage,
  gtmOutreachCampaign,
  gtmResearchRun,
} from "@/db/schema"

/**
 * One agent-chat conversation with its first 100 messages and, when it belongs
 * to a campaign, that campaign's live stage. Returns null when the conversation
 * is not in the organization. Backs GET /api/gtm/chat/conversations/[id].
 */
export async function getConversationWithMessages(
  conversationId: string,
  organizationId: string
) {
  // Messages only need the id, so load them alongside the ownership check and
  // discard them below if the conversation is not in this organization.
  const [[conversation], messages] = await Promise.all([
    db
      .select()
      .from(gtmConversation)
      .where(
        and(
          eq(gtmConversation.id, conversationId),
          eq(gtmConversation.organizationId, organizationId)
        )
      )
      .limit(1),
    db
      .select()
      .from(gtmMessage)
      .where(eq(gtmMessage.conversationId, conversationId))
      .orderBy(asc(gtmMessage.createdAt))
      .limit(100),
  ])

  if (!conversation) return null

  let linkedCampaign = null
  if (conversation.outreachCampaignId) {
    const [campaign] = await db
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
      .where(eq(gtmOutreachCampaign.id, conversation.outreachCampaignId))
      .limit(1)
    linkedCampaign = campaign || null
  }

  return {
    conversation,
    linkedCampaign,
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      toolCalls: m.toolCalls || [],
      artifact: m.artifact || null,
      createdAt: m.createdAt,
    })),
  }
}

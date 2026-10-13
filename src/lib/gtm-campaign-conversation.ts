import "server-only"

import { nanoid } from "nanoid"
import { db } from "@/utils/db"
import { gtmConversation, gtmMessage } from "@/db/schema"

interface SeedCampaignConversationParams {
  organizationId: string
  userId: string
  campaign: {
    id: string
    currentStage: string
    status: string
    createdAt: Date
  }
  researchRunId: string
  companyName: string
  segmentName: string
}

/**
 * Creates the agent-chat thread linked to a new outreach campaign, with an
 * assistant intro message, so the campaign shows up in the chat sidebar.
 * Called once when the campaign is created.
 */
export async function seedCampaignConversation({
  organizationId,
  userId,
  campaign,
  researchRunId,
  companyName,
  segmentName,
}: SeedCampaignConversationParams) {
  const [conversation] = await db
    .insert(gtmConversation)
    .values({
      id: nanoid(),
      organizationId,
      userId,
      title: `${companyName} — ${segmentName}`,
      outreachCampaignId: campaign.id,
      researchRunId,
      createdAt: campaign.createdAt,
      updatedAt: campaign.createdAt,
    })
    .returning()

  const content =
    `Autonomous GTM pipeline thread for **${companyName}** targeting **${segmentName}**.\n\n` +
    `- **Current Stage**: \`${campaign.currentStage.replace(/_/g, " ")}\`\n` +
    `- **Pipeline Status**: \`${campaign.status}\`\n\n` +
    `Ask me to inspect discovered decision-makers, review email drafts, or advance pipeline execution.`

  await db.insert(gtmMessage).values({
    id: nanoid(),
    conversationId: conversation.id,
    role: "assistant",
    content,
    createdAt: campaign.createdAt,
  })

  return conversation
}

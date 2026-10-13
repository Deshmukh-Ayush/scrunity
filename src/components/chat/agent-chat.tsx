import { getTenantContext } from "@/lib/tenant-context"
import { getConversationWithMessages } from "@/lib/data/chat"
import { asJson } from "@/lib/data/serialize"
import { AgentChatInterface } from "./agent-chat-interface"
import type { InitialConversation } from "./types"

/** Pre-loads the conversation named in ?id= (if any) so the thread renders with the page. */
export async function AgentChat({
  conversationId,
}: {
  conversationId: string | null
}) {
  const { organizationId } = await getTenantContext()
  const result =
    conversationId && organizationId
      ? await getConversationWithMessages(conversationId, organizationId)
      : null

  const initialConversation: InitialConversation | null = result
    ? asJson<InitialConversation>({
        id: result.conversation.id,
        title: result.conversation.title,
        messages: result.messages,
        linkedCampaign: result.linkedCampaign,
      })
    : null

  return <AgentChatInterface initialConversation={initialConversation} />
}

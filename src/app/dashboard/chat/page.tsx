import { Suspense } from "react"
import { AgentChat } from "@/components/chat/agent-chat"
import { AgentChatSkeleton } from "@/components/chat/agent-chat-skeleton"

export const metadata = {
  title: "Agent Chat | Scrunity GTM",
  description:
    "Autonomous GTM agent co-pilot for pipeline queries, prospect inspection, and campaign actions.",
}

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[] }>
}) {
  const { id } = await searchParams

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <Suspense fallback={<AgentChatSkeleton />}>
        <AgentChat conversationId={typeof id === "string" ? id : null} />
      </Suspense>
    </div>
  )
}

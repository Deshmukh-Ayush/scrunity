import { redirect } from "next/navigation"
import { AgentChat } from "@/components/chat/agent-chat"

export const metadata = {
  title: "Chat | Scrunity",
  description:
    "Talk to the outreach agent about your campaigns, leads and replies.",
}

/**
 * One agent chat (/dashboard/chat?id=…). New chats start from the composer on
 * Home, so a bare /dashboard/chat goes there. No Suspense boundary: the page
 * commits with the navigation, which lets the composer's view transition pair
 * with Home's.
 */
export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[] }>
}) {
  const { id } = await searchParams
  if (typeof id !== "string" || !id) redirect("/dashboard")

  return <AgentChat conversationId={id} />
}

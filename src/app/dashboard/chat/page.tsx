import * as React from "react";
import { Suspense } from "react";
import { AgentChatInterface } from "@/components/chat/agent-chat-interface";
import { AgentChatSkeleton } from "@/components/chat/agent-chat-skeleton";

export const metadata = {
  title: "Agent Chat | Scrunity GTM",
  description:
    "Autonomous GTM agent co-pilot for pipeline queries, prospect inspection, and campaign actions.",
};

export default function ChatPage() {
  return (
    <div className="h-full w-full overflow-hidden flex flex-col">
      <Suspense fallback={<AgentChatSkeleton />}>
        <AgentChatInterface />
      </Suspense>
    </div>
  );
}

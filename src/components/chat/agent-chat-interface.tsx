"use client"

import * as React from "react"
import { Container } from "@/components/layout/container"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "@/components/ui/icons"
import {
  ChatContainerContent,
  ChatContainerRoot,
  ChatContainerScrollAnchor,
} from "@/components/ui/chat-container"
import { AgentComposer } from "./agent-composer"
import { ChatMessage } from "./chat-message"
import type { InitialConversation } from "./types"
import { useAgentChat } from "./use-agent-chat"

/**
 * One agent chat: its title, the scrolling thread and the composer pinned at
 * the bottom. The composer shares its view-transition name with Home's, so
 * arriving from Home moves it down into place.
 */
export function AgentChatInterface({
  initialConversation = null,
}: {
  initialConversation?: InitialConversation | null
}) {
  const chat = useAgentChat(initialConversation)
  const [inputValue, setInputValue] = React.useState("")

  const send = () => {
    const prompt = inputValue
    if (!prompt.trim() || chat.isGenerating) return
    setInputValue("")
    chat.sendMessage(prompt)
  }

  const title = chat.linkedCampaign
    ? `${chat.linkedCampaign.companyName} · ${chat.linkedCampaign.segmentName}`
    : chat.activeTitle || "Chat"

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
      <Container
        width="prose"
        className="flex shrink-0 items-center gap-2 pt-1 pb-2"
      >
        <h1 className="min-w-0 truncate text-section text-fg-default">
          {title}
        </h1>
        {chat.linkedCampaign && (
          <Badge variant="neutral" className="shrink-0 capitalize">
            {chat.linkedCampaign.currentStage.replace(/_/g, " ")}
          </Badge>
        )}
      </Container>

      <ChatContainerRoot className="min-h-0 flex-1">
        <ChatContainerContent>
          <Container width="prose" className="flex flex-col gap-6 py-4">
            {chat.isLoadingConversation ? (
              <div
                role="status"
                className="flex items-center justify-center gap-2 py-24 text-body text-fg-muted"
              >
                <Loader2 className="size-4 motion-safe:animate-spin" />
                <span>Loading the chat</span>
              </div>
            ) : (
              chat.messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  isGenerating={chat.isGenerating}
                />
              ))
            )}
          </Container>
          <ChatContainerScrollAnchor />
        </ChatContainerContent>
      </ChatContainerRoot>

      <Container width="prose" className="shrink-0 pt-2 pb-4 md:pb-6">
        <AgentComposer
          transitionName="agent-composer"
          value={inputValue}
          onValueChange={setInputValue}
          onSubmit={send}
          onStop={chat.stopGenerating}
          generating={chat.isGenerating}
          placeholder="Reply to the agent"
        />
      </Container>
    </div>
  )
}

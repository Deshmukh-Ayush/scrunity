"use client"

import * as React from "react"
import { ArrowUp, Loader2, RotateCcw, StopCircle } from "@/components/ui/icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ChatContainerContent,
  ChatContainerRoot,
  ChatContainerScrollAnchor,
} from "@/components/ui/chat-container"
import {
  PromptInput,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/ui/prompt-input"
import { ChatMessage } from "./chat-message"
import { ChatWelcome } from "./chat-welcome"
import type { InitialConversation } from "./types"
import { useAgentChat } from "./use-agent-chat"

/** Agent chat: header, scrolling thread (or starter prompts), and the composer. */
export function AgentChatInterface({
  initialConversation = null,
}: {
  initialConversation?: InitialConversation | null
}) {
  const chat = useAgentChat(initialConversation)
  const [inputValue, setInputValue] = React.useState("")

  const send = (text?: string) => {
    const prompt = text ?? inputValue
    if (!prompt.trim() || chat.isGenerating) return
    setInputValue("")
    chat.sendMessage(prompt)
  }

  const title = chat.linkedCampaign
    ? `${chat.linkedCampaign.companyName} — ${chat.linkedCampaign.segmentName}`
    : chat.activeTitle ||
      (chat.activeConversationId ? "Conversation" : "New Chat")

  return (
    <div className="relative flex h-full w-full min-w-0 flex-col overflow-hidden bg-background">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border/60 bg-background/80 px-5 backdrop-blur-xs">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="truncate text-xs font-semibold text-foreground">
            {title}
          </span>
          {chat.linkedCampaign && (
            <Badge
              variant="neutral"
              className="shrink-0 px-2 py-0 font-mono text-primary capitalize">
              {chat.linkedCampaign.currentStage.replace(/_/g, " ")}
            </Badge>
          )}
        </div>
        {chat.messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setInputValue("")
              chat.startNewChat()
            }}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3" />
            Reset
          </Button>
        )}
      </header>

      <ChatContainerRoot className="flex-1 space-y-6 px-4 py-6 md:px-8">
        <ChatContainerContent className="mx-auto w-full max-w-3xl space-y-6">
          {chat.isLoadingConversation ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-xs text-muted-foreground">
              <Loader2 className="size-5 animate-spin text-primary" />
              <span>Loading conversation thread...</span>
            </div>
          ) : chat.messages.length === 0 ? (
            <ChatWelcome onPrompt={send} />
          ) : (
            chat.messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                isGenerating={chat.isGenerating}
              />
            ))
          )}
          <ChatContainerScrollAnchor />
        </ChatContainerContent>
      </ChatContainerRoot>

      <div className="shrink-0 border-t border-border/50 bg-background/80 p-4 backdrop-blur-xs md:p-6">
        <div className="mx-auto w-full max-w-3xl">
          <PromptInput
            value={inputValue}
            onValueChange={setInputValue}
            onSubmit={() => send()}
            disabled={chat.isGenerating}
            className="rounded-2xl border-border/80 bg-muted/30 p-2 transition-all focus-within:border-primary/50 focus-within:bg-background focus-within:shadow-xs"
          >
            <PromptInputTextarea
              placeholder="Ask about campaigns, search prospects, or give instructions..."
              className="max-h-36 min-h-[44px] resize-none px-3 py-2 text-xs"
            />
            <PromptInputActions className="justify-between px-2 pt-1">
              <span className="hidden text-[10px] text-muted-foreground/60 sm:inline">
                Press <kbd className="font-mono">Enter</kbd> to send,{" "}
                <kbd className="font-mono">Shift+Enter</kbd> for new line
              </span>
              <div className="flex items-center gap-2">
                {chat.isGenerating ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={chat.stopGenerating}
                    className="size-8 rounded-full border-destructive/30 p-0 text-danger hover:bg-danger-tint"
                    title="Stop generating"
                    aria-label="Stop generating"
                  >
                    <StopCircle className="size-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="brand"
                    size="icon"
                    disabled={!inputValue.trim()}
                    onClick={() => send()}
                    title="Send message"
                    aria-label="Send message"
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                )}
              </div>
            </PromptInputActions>
          </PromptInput>
        </div>
      </div>
    </div>
  )
}

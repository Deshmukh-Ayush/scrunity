import { Bot } from "@/components/ui/icons"
import { Markdown } from "@/components/ui/markdown"
import { Tool } from "@/components/ui/tool"
import type { ChatMessage as ChatMessageData } from "./types"

/** One turn: a right-aligned user bubble, or the agent's tool calls plus markdown reply. */
export function ChatMessage({
  message,
  isGenerating,
}: {
  message: ChatMessageData
  isGenerating: boolean
}) {
  if (message.role === "user") {
    return (
      <div className="flex w-full justify-end">
        <div className="max-w-[85%] rounded-xl bg-muted px-3.5 py-2 text-composer whitespace-pre-wrap text-fg-strong">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex w-full items-start gap-3">
      <div
        aria-hidden="true"
        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-surface text-fg-default shadow-raised"
      >
        <Bot className="size-4" />
      </div>

      <div className="min-w-0 flex-1 space-y-3">
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="space-y-2">
            {message.toolCalls.map((toolCall, idx) => (
              <Tool
                key={toolCall.toolCallId || idx}
                toolPart={toolCall}
                defaultOpen={false}
              />
            ))}
          </div>
        )}

        {message.content ? (
          <div className="text-composer text-fg-strong [&_.prose]:text-composer">
            <Markdown>{message.content}</Markdown>
          </div>
        ) : (
          isGenerating && (
            <p role="status" className="py-0.5 text-composer">
              <span className="t-shimmer" data-text="Working on it">
                Working on it
              </span>
            </p>
          )
        )}
      </div>
    </div>
  )
}

import { Bot, Loader2 } from "@/components/ui/icons"
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
        <div className="max-w-[85%] rounded-2xl border border-border/70 bg-muted/80 px-4 py-2.5 text-xs leading-relaxed whitespace-pre-wrap text-foreground shadow-2xs">
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex w-full items-start gap-3">
      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary shadow-2xs">
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
                className="text-xs"
              />
            ))}
          </div>
        )}

        {message.content ? (
          <div className="prose-sm dark:prose-invert text-xs leading-relaxed text-foreground">
            <Markdown>{message.content}</Markdown>
          </div>
        ) : (
          isGenerating && (
            <div className="flex items-center gap-1.5 py-1 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin text-primary" />
              <span>Agent is analyzing...</span>
            </div>
          )
        )}
      </div>
    </div>
  )
}

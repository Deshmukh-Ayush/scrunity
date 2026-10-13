import type { ToolPart } from "@/components/ui/tool"

/** Text and tool-call progress accumulated from one streamed assistant reply. */
export interface StreamAccumulator {
  content: string
  toolSteps: ToolPart[]
}

/**
 * Splits buffered SSE text into complete `data:` payloads (parsed as JSON) and
 * the unfinished remainder to keep for the next chunk.
 */
export function readSseEvents(buffer: string): {
  events: unknown[]
  rest: string
} {
  const blocks = buffer.split("\n\n")
  const rest = blocks.pop() || ""
  const events: unknown[] = []

  for (const block of blocks) {
    const trimmed = block.trim()
    if (!trimmed.startsWith("data:")) continue
    const payload = trimmed.replace(/^data:\s*/, "")
    if (payload === "[DONE]") continue
    try {
      events.push(JSON.parse(payload))
    } catch {
      // ignore non-JSON chunks
    }
  }

  return { events, rest }
}

/** Folds one AI SDK UI-stream part into the accumulator (mutates it). */
export function applyStreamPart(acc: StreamAccumulator, part: any) {
  const toolCallId = part.toolCallId || part.id
  const findTool = () =>
    acc.toolSteps.findIndex((t) => t.toolCallId === toolCallId)

  switch (part.type) {
    case "text-delta":
      if (typeof part.delta === "string") acc.content += part.delta
      break

    case "tool-input-available":
    case "tool-call": {
      const tool: ToolPart = {
        type: part.toolName || part.name || "tool",
        state: "input-streaming",
        input: part.input || part.args || {},
        toolCallId,
      }
      const idx = findTool()
      if (idx >= 0) acc.toolSteps[idx] = tool
      else acc.toolSteps.push(tool)
      break
    }

    case "tool-output-available":
    case "tool-result": {
      const idx = findTool()
      if (idx >= 0) {
        acc.toolSteps[idx].state = "output-available"
        acc.toolSteps[idx].output = part.output || part.result
      }
      break
    }

    case "tool-input-error":
    case "tool-output-error": {
      const idx = findTool()
      if (idx >= 0) {
        acc.toolSteps[idx].state = "output-error"
        acc.toolSteps[idx].errorText =
          part.errorText || part.error || "Execution failed"
      }
      break
    }

    case "error":
      if (typeof part.errorText === "string")
        acc.content += `\n\n*Error: ${part.errorText}*`
      break
  }
}

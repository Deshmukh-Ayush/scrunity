import type { z } from "zod"
import { groqLlmProvider } from "./groq"

/**
 * The one seam between pipeline code and a language model. Pipeline code asks
 * for validated JSON or plain text; which vendor and model answer is decided
 * here. Groq (gpt-oss-120b, fallback 20b) is the only implementation today; a
 * second one only needs to implement this interface and be returned below.
 *
 * Streaming chat with tools (app/api/gtm/chat) is not behind this interface:
 * it uses the AI SDK model object directly.
 */
export interface LlmProvider {
  readonly key: string
  /** JSON matching `schema`, validated. Throws when no attempt produced valid output. */
  generateStructured<T>(request: {
    schema: z.ZodType<T>
    system: string
    prompt: string
    maxTokens?: number
  }): Promise<T>
  /** Plain text. */
  generateText(request: { system: string; prompt: string; maxTokens?: number }): Promise<string>
}

export function getLlmProvider(): LlmProvider {
  return groqLlmProvider
}

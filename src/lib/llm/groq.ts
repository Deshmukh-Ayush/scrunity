import { groq } from "@ai-sdk/groq"
import { generateText, Output } from "ai"
import type { LlmProvider } from "./provider"

export const primaryModel = groq("openai/gpt-oss-120b")
export const fallbackModel = groq("openai/gpt-oss-20b")

/**
 * Options for every structured (JSON) call. gpt-oss is a reasoning model and
 * its reasoning tokens count against maxOutputTokens: at the default effort a
 * 500-token cap was sometimes spent entirely on reasoning, and Groq answered
 * "Failed to validate JSON" with an empty failed_generation (seen in 1 of 24
 * paced replays and twice in the live test). Low effort keeps reasoning short.
 * Caps stay moderate because Groq counts the requested cap against the
 * free tier's 8,000 tokens-per-minute limit.
 */
export const primaryStructuredOptions = {
  providerOptions: { groq: { reasoningEffort: "low" as const } },
}

const messageOf = (err: unknown) => (err instanceof Error ? err.message : err)

/**
 * Groq behind LlmProvider. Structured calls run the primary model, then the
 * fallback model, then a direct JSON prompt with regex extraction (handles
 * Groq schema validation quirks). Behaviour is unchanged from the former
 * gtm-ai.ts generateStructuredWithFallback.
 */
export const groqLlmProvider: LlmProvider = {
  key: "groq",

  async generateStructured({ schema, system, prompt, maxTokens }) {
    try {
      const { output } = await generateText({
        model: primaryModel,
        output: Output.object({ schema }),
        system,
        prompt,
        maxOutputTokens: maxTokens,
        ...primaryStructuredOptions,
      })
      if (output) return output
    } catch (err) {
      console.warn("[GTM AI Fallback] Primary model error. Falling back to secondary model:", messageOf(err))
    }

    try {
      const { output } = await generateText({
        model: fallbackModel,
        output: Output.object({ schema }),
        system,
        prompt,
        maxOutputTokens: maxTokens,
        ...primaryStructuredOptions,
      })
      if (output) return output
    } catch (err) {
      console.warn(
        "[GTM AI Fallback] Secondary model error. Attempting resilient direct JSON fallback:",
        messageOf(err)
      )
    }

    const res = await generateText({
      model: primaryModel,
      system: `${system}\nCRITICAL: Respond ONLY with a valid JSON object matching the requested schema. No surrounding markdown, no explanations.`,
      prompt,
      maxOutputTokens: maxTokens,
    })
    const jsonMatch = res.text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        return schema.parse(JSON.parse(jsonMatch[0]))
      } catch (parseErr) {
        console.warn("[GTM AI Fallback] Level-3 direct JSON parse failed:", parseErr)
      }
    }
    throw new Error("Both primary, secondary, and direct AI models failed to produce output.")
  },

  async generateText({ system, prompt, maxTokens }) {
    const res = await generateText({ model: primaryModel, system, prompt, maxOutputTokens: maxTokens })
    return res.text
  },
}

import { isDev } from "@/inngest/client"

/**
 * Which executor runs pipeline stages. Exactly one is used per trigger — never
 * both — so a run can't be executed twice in parallel.
 *
 * - `inngest`: durable stage functions (inngest/functions/pipeline-stages.ts).
 *   The default for deployed environments, where work after the HTTP response
 *   is not guaranteed to finish.
 * - `direct`: an in-process runner started with `after()`. The default for
 *   local development, so the pipeline works without `npm run inngest:dev`.
 *
 * Override with PIPELINE_EXECUTOR=inngest|direct.
 */
export type PipelineExecutor = "inngest" | "direct"

export function getPipelineExecutor(): PipelineExecutor {
  const override = process.env.PIPELINE_EXECUTOR
  if (override === "inngest" || override === "direct") return override
  return isDev ? "direct" : "inngest"
}

import type { ProcessActivityItem, ProcessState } from "@/components/ui/process-card"
import { plainDuration } from "./plain-duration"

/**
 * A research run's stored row -> ProcessCard state, in plain words. Pure and
 * client-safe. Every count and line comes from data the run already returns;
 * nothing is invented (there is no per-step event source for research runs).
 */

export const RESEARCH_STAGES = [
  { id: "research_company", label: "Research your company" },
  { id: "research_competitors", label: "Find competitors" },
  { id: "define_segments", label: "Build customer segments" },
] as const

const RUNNING_TEXT: Record<string, string> = {
  research_company: "Reading your website to understand what you sell.",
  research_competitors: "Looking for companies that sell something similar to you.",
  define_segments: "Grouping the companies most likely to buy into customer segments.",
}

/** Failure codes are already neutral (lib/data/public-fields.ts); this turns them into sentences. */
const FAILURE_TEXT: Record<string, string> = {
  web_search_attempt_limit:
    "Research stopped at this step's search limit, which protects your credits. Restart the step to try again.",
  web_search_total_limit:
    "This research run has used all of its searches. Start a new research run to continue.",
  web_search_daily_limit:
    "Your workspace reached today's search limit. Restart the step after midnight UTC.",
  web_search_monthly_limit:
    "This month's searches are almost used up, so research is paused. They reset with your next billing cycle.",
}

const FALLBACK_FAILURE = "Research stopped because of an error. Try again, or contact support if it keeps happening."

/** Known codes become sentences; anything else (internal codes, engineer-facing text) never leaks. */
export function researchFailureText(reason: string | null | undefined) {
  return (reason && FAILURE_TEXT[reason]) || FALLBACK_FAILURE
}

export interface ResearchProcessInput {
  status: string
  currentStage: string
  failureReason?: string | null
  companyName: string
  hasProfile: boolean
  competitorNames: string[]
  segmentCount: number
  /** From checkStageStaleness, after hydration only. */
  stalledForMs: number | null
}

const plural = (n: number, one: string, many: string) =>
  new Intl.PluralRules("en").select(n) === "one" ? one : many

export function deriveResearchProcess(input: ResearchProcessInput) {
  const isDone = input.status === "done" || input.currentStage === "done"
  const index = RESEARCH_STAGES.findIndex((s) => s.id === input.currentStage)
  const current = isDone ? RESEARCH_STAGES.length - 1 : Math.max(0, index)

  let state: ProcessState = "running"
  if (input.status === "failed") state = "failed"
  else if (isDone) state = input.segmentCount === 0 ? "no-results" : "done"
  else if (input.stalledForMs !== null) state = "stalled"

  const competitors = input.competitorNames.length
  const details: (string | undefined)[] = [
    current > 0 || isDone ? "Profile ready" : undefined,
    current > 1 || isDone ? `${competitors} ${plural(competitors, "competitor", "competitors")}` : undefined,
    isDone ? `${input.segmentCount} ${plural(input.segmentCount, "segment", "segments")}` : undefined,
  ]

  const stage = RESEARCH_STAGES[current]
  let status: string
  switch (state) {
    case "failed":
      status = researchFailureText(input.failureReason)
      break
    case "stalled":
      status = `No progress for ${plainDuration(input.stalledForMs ?? 0)}. Restart this step to try again.`
      break
    case "no-results":
      status = "No customer segments came out of this research. Edit your description and run it again."
      break
    case "done":
      status = "Research is finished. Next, check the company profile it built."
      break
    default:
      status = RUNNING_TEXT[stage.id]
  }

  const announcement =
    state === "done"
      ? "Research finished"
      : state === "failed"
        ? `${stage.label} failed`
        : state === "stalled"
          ? `${stage.label} stalled`
          : `${stage.label} in progress`

  const activity: ProcessActivityItem[] = []
  if (input.hasProfile)
    activity.push({ id: "profile", text: `Built a profile of ${input.companyName}` })
  if (competitors > 0) {
    const names = input.competitorNames.slice(0, 3).join(", ")
    const more = competitors > 3 ? ` and ${competitors - 3} more` : ""
    activity.push({
      id: `competitors-${competitors}`,
      text: `Found ${competitors} ${plural(competitors, "competitor", "competitors")}: ${names}${more}`,
    })
  }
  if (input.segmentCount > 0)
    activity.push({
      id: `segments-${input.segmentCount}`,
      text: `Built ${input.segmentCount} customer ${plural(input.segmentCount, "segment", "segments")}`,
    })

  return {
    state,
    current,
    details,
    pill: `Step ${current + 1} of ${RESEARCH_STAGES.length}`,
    status,
    announcement,
    activity,
  }
}

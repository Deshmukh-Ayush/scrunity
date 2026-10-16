import { Activity, Clock } from "@/components/ui/icons"
import {
  AlertTriangleSolid,
  CheckCircleSolid,
  InfoCircleSolid,
  XCircleSolid,
} from "@/components/icons/status"
import type { StatusTone } from "@/components/ui/data-table"
import { checkStageStaleness } from "@/lib/gtm-staleness"

/**
 * Plain-word status and stage labels for campaigns and research runs, so no
 * raw snake_case reaches the screen. Stalled detection is the existing
 * checkStageStaleness; it depends on the clock, so callers pass `now` only
 * after hydration (before it, nothing reads as stalled).
 */

export interface PipelineStatus<Bucket extends string> {
  label: string
  tone: StatusTone
  bucket: Bucket
  icon: React.ReactNode
}

const icon = {
  done: <CheckCircleSolid data-icon="inline-start" />,
  failed: <XCircleSolid data-icon="inline-start" />,
  stalled: <AlertTriangleSolid data-icon="inline-start" />,
  review: <InfoCircleSolid data-icon="inline-start" />,
  running: <Activity data-icon="inline-start" />,
  paused: <Clock data-icon="inline-start" />,
}

interface PipelineRowLike {
  status: string
  currentStage: string
  createdAt?: string | Date | null
  stageStartedAt?: string | Date | null
  lastProgressAt?: string | Date | null
}

function isStalled(row: PipelineRowLike, hydrated: boolean) {
  if (!hydrated) return false
  return checkStageStaleness({
    stage: row.currentStage,
    status: row.status,
    stageStartedAt: row.stageStartedAt,
    lastProgressAt: row.lastProgressAt,
    createdAt: row.createdAt,
  }).isStalled
}

export type CampaignBucket =
  | "needs-review"
  | "running"
  | "stalled-failed"
  | "done"
  | "paused"

export const CAMPAIGN_BUCKETS: { value: CampaignBucket; label: string }[] = [
  { value: "needs-review", label: "Needs review" },
  { value: "running", label: "Running" },
  { value: "stalled-failed", label: "Stalled or failed" },
  { value: "done", label: "Done" },
  { value: "paused", label: "Paused" },
]

export function campaignStatus(
  row: PipelineRowLike,
  hydrated: boolean
): PipelineStatus<CampaignBucket> {
  if (row.status === "failed")
    return {
      label: "Failed",
      tone: "danger",
      bucket: "stalled-failed",
      icon: icon.failed,
    }
  if (row.status === "paused" || row.status === "paused_credits_exhausted")
    return {
      label: "Paused",
      tone: "neutral",
      bucket: "paused",
      icon: icon.paused,
    }
  if (
    row.status === "done" ||
    row.currentStage === "done" ||
    row.currentStage === "done_for_now"
  )
    return { label: "Done", tone: "success", bucket: "done", icon: icon.done }
  if (
    row.status === "awaiting_approval" ||
    row.currentStage === "awaiting_approval" ||
    row.currentStage === "awaiting_company_selection"
  )
    return {
      label: "Needs review",
      tone: "warning",
      bucket: "needs-review",
      icon: icon.review,
    }
  if (isStalled(row, hydrated))
    return {
      label: "Stalled",
      tone: "warning",
      bucket: "stalled-failed",
      icon: icon.stalled,
    }
  return {
    label: "Running",
    tone: "neutral",
    bucket: "running",
    icon: icon.running,
  }
}

/** True when the campaign is waiting for drafts to be approved (the "Review drafts" action). */
export function isAwaitingApproval(row: PipelineRowLike) {
  return (
    row.status === "awaiting_approval" ||
    row.currentStage === "awaiting_approval"
  )
}

const CAMPAIGN_STAGES: Record<string, string> = {
  find_companies: "Find companies",
  awaiting_company_selection: "Choose companies",
  find_contacts: "Find contacts",
  write_emails: "Write emails",
  awaiting_approval: "Review drafts",
  send_emails: "Send emails",
  done_for_now: "Done for now",
  done: "Complete",
}

export function campaignStageLabel(row: PipelineRowLike) {
  if (row.status === "done") return "Complete"
  return CAMPAIGN_STAGES[row.currentStage] ?? humanize(row.currentStage)
}

export type ResearchBucket = "running" | "stalled" | "failed" | "completed"

export const RESEARCH_BUCKETS: { value: ResearchBucket; label: string }[] = [
  { value: "running", label: "Running" },
  { value: "stalled", label: "Stalled" },
  { value: "failed", label: "Failed" },
  { value: "completed", label: "Completed" },
]

export function researchStatus(
  row: PipelineRowLike,
  hydrated: boolean
): PipelineStatus<ResearchBucket> {
  if (row.status === "done" || row.currentStage === "done")
    return {
      label: "Completed",
      tone: "success",
      bucket: "completed",
      icon: icon.done,
    }
  if (row.status === "failed")
    return {
      label: "Failed",
      tone: "danger",
      bucket: "failed",
      icon: icon.failed,
    }
  if (isStalled(row, hydrated))
    return {
      label: "Stalled",
      tone: "warning",
      bucket: "stalled",
      icon: icon.stalled,
    }
  return {
    label: "Running",
    tone: "neutral",
    bucket: "running",
    icon: icon.running,
  }
}

/** Last resort for a stage this file does not know yet: "new_stage" → "New stage". */
function humanize(value: string) {
  const text = value.replace(/_/g, " ").trim()
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** Counts per bucket, in the given order, keeping only buckets with results. */
export function bucketChips<B extends string>(
  buckets: { value: B; label: string }[],
  statuses: { bucket: B }[]
) {
  return buckets
    .map((b) => ({
      ...b,
      count: statuses.filter((s) => s.bucket === b.value).length,
    }))
    .filter((b) => b.count > 0)
}

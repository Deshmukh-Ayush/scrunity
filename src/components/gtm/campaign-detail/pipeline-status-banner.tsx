"use client"

import { AlertCircle, AlertTriangle, Loader2, RotateCcw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useCampaignDetail } from "./campaign-detail-root"

const RUNNING_STAGE_DESCRIPTIONS: Record<string, string> = {
  find_companies:
    "Searching for ICP-fit companies, extracting company metadata, and verifying domain details...",
  find_contacts:
    "Finding decision makers and verifying their email addresses. Only verified addresses are kept...",
  write_emails:
    "Generating highly personalized cold emails tailored to each contact and company...",
  send_emails:
    "Dispatching approved drafts with human-like throttling (30-90s delay)...",
}

const FAILURE_REASON_TEXT: Record<string, string> = {
  web_search_attempt_limit:
    "This step stopped because it reached its web-search safety limit for one attempt, which protects your credits. Click Retry Campaign to run it again with a fresh limit.",
  web_search_total_limit:
    "This campaign has used its total web-search allowance across all its retries, so it will not search again. Start a new campaign from the same research to continue.",
  web_search_daily_limit:
    "Paused: your organization reached today's web-search limit. Restart the stage after 00:00 UTC to continue.",
  web_search_monthly_limit:
    "Campaign paused: Your organization's monthly web search allotment is nearly exhausted for this billing cycle.",
  company_search_monthly_limit:
    "Company search paused: this month's company-database budget is used up. It resets at the start of next month.",
  company_search_unavailable:
    "Company search stopped: the company-database account is out of credits. No further searches were attempted.",
  provider_access_denied:
    "Company search failed: the company-database account does not allow this search. Check the provider plan or API key.",
  provider_rate_limited:
    "Company search failed: the company database is rate-limiting requests. Retry in a few minutes.",
  provider_request_failed:
    "Company search failed: the company database returned an error. Retry the campaign.",
  people_search_unavailable:
    "Decision-maker search is not available yet, so this campaign stopped after your company selection. Nothing was charged.",
  email_lookup_unavailable:
    "Email verification is not available right now, so no contacts were looked up and no addresses were guessed. Contact support.",
  email_lookup_monthly_limit:
    "Email verification paused: this month's verification budget is used up. No addresses were guessed.",
  target_country_missing:
    "Company search needs a target country. Start a new research run with a target country selected.",
}

/** Restart and retry are recovery actions, so they stay neutral rather than primary. */
function RecoveryButton({
  label,
  onClick,
  tone = "neutral",
}: {
  label: string
  onClick: () => void
  tone?: "neutral" | "warning"
}) {
  const { isRestarting } = useCampaignDetail()
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={isRestarting}
      data-tone={tone}
      className="h-8 gap-1.5 text-xs data-[tone=warning]:border-warning-border data-[tone=warning]:text-warning data-[tone=warning]:hover:bg-warning-tint"
    >
      {isRestarting ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <RotateCcw className="size-3.5" />
      )}
      {label}
    </Button>
  )
}

/**
 * The one place that explains a running, stalled or failed pipeline and offers
 * the matching recovery action. Renders nothing for idle or finished campaigns.
 */
export function PipelineStatusBanner() {
  const { data, staleness, restartStage, restartPipeline } = useCampaignDetail()
  const { campaign, inngestConnectivity } = data
  const stageLabel = campaign.currentStage.replace(/_/g, " ")
  const inngestOffline = inngestConnectivity && !inngestConnectivity.connected

  if (campaign.status === "in_progress" && staleness.isStalled) {
    return (
      <Card className="border-warning-border bg-warning-tint p-4">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0 rounded-full bg-warning-tint p-2 text-warning">
              <AlertTriangle className="size-5" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-foreground">
                <span>Autonomous Pipeline Stalled:</span>
                <Badge
                  variant="outline"
                  className="border-warning-border bg-warning-tint text-[11px] font-medium text-warning capitalize"
                >
                  {stageLabel} (Stalled)
                </Badge>
                {inngestOffline && (
                  <Badge
                    variant="outline"
                    className="border-warning-border bg-warning-tint text-[10px] text-warning"
                  >
                    Inngest Offline
                  </Badge>
                )}
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {staleness.explanation}
              </p>
              {inngestOffline && (
                <p className="mt-0.5 font-mono text-[11px] text-warning">
                  Start the background runner with: npm run inngest:dev
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
            <RecoveryButton
              label="Restart Stage"
              onClick={restartStage}
              tone="warning"
            />
          </div>
        </div>
      </Card>
    )
  }

  if (campaign.status === "in_progress") {
    return (
      <Card className="border-primary/30 bg-primary/5 p-4">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-primary/10 p-2 text-primary">
              <Loader2 className="size-5 animate-spin" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <span>Autonomous Pipeline In Progress:</span>
                <Badge
                  variant="outline"
                  className="border-primary/40 bg-primary/10 text-[11px] font-medium text-primary capitalize"
                >
                  {stageLabel}
                </Badge>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {RUNNING_STAGE_DESCRIPTIONS[campaign.currentStage] ||
                  "Autonomous agent is executing pipeline tasks..."}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
            <RecoveryButton label="Restart Stage" onClick={restartStage} />
          </div>
        </div>
      </Card>
    )
  }

  if (campaign.status === "failed") {
    const reason = campaign.failureReason
    return (
      <Card className="border-destructive/40 bg-destructive/5 p-4">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-destructive/10 p-2 text-destructive">
              <AlertCircle className="size-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <span>Autonomous Pipeline Halted:</span>
                <Badge
                  variant="destructive"
                  className="text-[11px] font-medium capitalize"
                >
                  Failed
                </Badge>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {reason
                  ? FAILURE_REASON_TEXT[reason] || `Campaign failed: ${reason}`
                  : "An unexpected error occurred during campaign execution."}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
            <RecoveryButton label="Retry Campaign" onClick={restartPipeline} />
          </div>
        </div>
      </Card>
    )
  }

  return null
}

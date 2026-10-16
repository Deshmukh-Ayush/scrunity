"use client"

import { RotateCcw, Send } from "@/components/ui/icons"
import {
  AlertTriangleSolid,
  CheckCircleSolid,
  InfoCircleSolid,
  XCircleSolid,
} from "@/components/icons/status"
import { Activity, Clock, Minus } from "@/components/ui/icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LocalDate } from "@/components/ui/local-date"
import { formatTargetMarket } from "@/lib/geo/countries"
import type { ProcessState } from "@/components/ui/process-card"
import { useCampaignDetail } from "./campaign-detail-root"

const BADGE_ICON: Record<ProcessState, React.ReactNode> = {
  running: <Activity data-icon="inline-start" />,
  idle: <InfoCircleSolid data-icon="inline-start" />,
  stalled: <AlertTriangleSolid data-icon="inline-start" />,
  failed: <XCircleSolid data-icon="inline-start" />,
  done: <CheckCircleSolid data-icon="inline-start" />,
  "no-results": <Minus data-icon="inline-start" />,
  paused: <Clock data-icon="inline-start" />,
}

/**
 * Segment name, one muted line (created date and target), the status in
 * plain words, and the page actions: Start sending (the one brand button,
 * when approved emails wait) and Re-run when nothing is running. Retry and
 * Restart step live in the process card's footer.
 */
export function CampaignDetailHeader() {
  const { data, process, counts, mailbox, isDispatching, isRestarting, startSending, restartPipeline } =
    useCampaignDetail()
  const { campaign, segment } = data
  const market = formatTargetMarket(campaign.targetCountryCode, campaign.targetRegion)
  const canRerun = campaign.status !== "in_progress" && campaign.status !== "failed"
  const canSend = counts.approved > 0 && campaign.currentStage !== "send_emails"

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="min-w-0 text-title text-fg-strong">{segment.name}</h1>
          <Badge variant={process.badge.tone}>
            {BADGE_ICON[process.state]}
            {process.badge.label}
          </Badge>
        </div>
        <p className="text-body text-fg-muted">
          Created <LocalDate value={campaign.createdAt} options={{ day: "numeric", month: "short", year: "numeric" }} />
          {market ? ` · Targeting ${market}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {canRerun && (
          <Button onClick={restartPipeline} loading={isRestarting}>
            <RotateCcw data-icon="inline-start" />
            Re-run
          </Button>
        )}
        {canSend && (
          <Button
            variant="brand"
            onClick={startSending}
            loading={isDispatching}
            disabled={!mailbox}
            title={mailbox ? undefined : "Connect a mailbox first"}
          >
            <Send data-icon="inline-start" />
            {`Send ${counts.approved} approved`}
          </Button>
        )}
      </div>
    </div>
  )
}

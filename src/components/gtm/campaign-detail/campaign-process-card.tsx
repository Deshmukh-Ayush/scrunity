"use client"

import Link from "next/link"
import { Building2, CheckCircle2, Mail, RotateCcw, Send, Users } from "@/components/ui/icons"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  ProcessActivity,
  ProcessCard,
  ProcessFooter,
  ProcessProgress,
  ProcessStages,
} from "@/components/ui/process-card"
import { CAMPAIGN_STAGES } from "../process/campaign-process"
import { useCampaignDetail } from "./campaign-detail-root"

export const STAGE_DETAIL_ID = "campaign-stage-detail"

const STAGE_ICONS = [
  <Building2 key="companies" className="size-4" />,
  <Users key="contacts" className="size-4" />,
  <Mail key="write" className="size-4" />,
  <CheckCircle2 key="review" className="size-4" />,
  <Send key="send" className="size-4" />,
]

/**
 * The campaign's five stages as a ProcessCard, from the polled campaign and
 * drafts. Each tile shows that stage's detail below the card. Controls are
 * the ones that exist: Restart step (stalled), Retry campaign (failed), and
 * links for a no-results or paused ending.
 */
export function CampaignProcessCard({ motion }: { motion?: "auto" | "reduce" }) {
  const { data, process, selectedStage, selectStage, isRestarting, restartStage, restartPipeline } =
    useCampaignDetail()
  const { campaign } = data

  return (
    <ProcessCard
      state={process.state}
      title="Campaign progress"
      pill={`Step ${process.current + 1} of ${CAMPAIGN_STAGES.length}`}
      startedAt={campaign.stageStartedAt ?? campaign.createdAt}
      announcement={process.announcement}
      motion={motion}
    >
      <ProcessStages
        label="Campaign steps"
        current={process.current}
        stages={CAMPAIGN_STAGES.map((stage, i) => ({
          id: stage.id,
          label: stage.label,
          icon: STAGE_ICONS[i],
          detail: process.details[i],
          onSelect: () => selectStage(i),
          selected: selectedStage === i,
          controls: STAGE_DETAIL_ID,
        }))}
      />
      {process.progress && <ProcessProgress {...process.progress} />}
      <ProcessActivity items={process.activity} />
      <ProcessFooter status={process.status}>
        {process.state === "stalled" && (
          <Button onClick={restartStage} loading={isRestarting}>
            <RotateCcw data-icon="inline-start" />
            Restart step
          </Button>
        )}
        {process.state === "failed" && (
          <Button onClick={restartPipeline} loading={isRestarting}>
            <RotateCcw data-icon="inline-start" />
            Retry campaign
          </Button>
        )}
        {process.state === "no-results" && (
          <Link href="/dashboard/campaigns/new" className={buttonVariants()}>
            Start a new research run
          </Link>
        )}
        {process.state === "paused" && (
          <Link href="/dashboard/billing" className={buttonVariants()}>
            Go to billing
          </Link>
        )}
      </ProcessFooter>
    </ProcessCard>
  )
}

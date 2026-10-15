"use client"

import Link from "next/link"
import { AlertCircle, ArrowLeft, Loader2, RotateCcw, Send } from "@/components/ui/icons"
import { Badge } from "@/components/ui/badge"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useCampaignDetail } from "./campaign-detail-root"

/**
 * Title, live stage badge, and the page-level actions: "Start Sending" (the one
 * primary action) and "Re-run" when no stage is running. Restarting a running or
 * failed stage lives in the status banner instead.
 */
export function CampaignDetailHeader() {
  const {
    data,
    staleness,
    counts,
    mailbox,
    isDispatching,
    isRestarting,
    startSending,
    restartPipeline,
  } = useCampaignDetail()
  const { campaign, segment, researchRun, inngestConnectivity } = data
  const stageLabel = campaign.currentStage.replace(/_/g, " ")
  const inngestOffline = inngestConnectivity && !inngestConnectivity.connected

  return (
    <div>
      <Link
        href="/dashboard/campaigns"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "mb-3 -ml-2 gap-1 text-xs"
        )}
      >
        <ArrowLeft className="mr-1 size-3.5" />
        Back to Campaigns
      </Link>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {segment.name} Outreach Pipeline
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Campaign targeting {researchRun.companyName}&apos;s verified ICP
            segment.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {campaign.status === "in_progress" ? (
            staleness.isStalled ? (
              <Badge
                variant="warning"
                className="gap-1.5 self-start px-3 py-1 capitalize sm:self-auto">
                <AlertCircle className="size-3 text-warning" />
                {stageLabel} (Stalled)
              </Badge>
            ) : (
              <Badge
                variant="neutral"
                className="gap-1.5 self-start px-3 py-1 text-primary capitalize sm:self-auto">
                <Loader2 className="size-3 animate-spin" />
                {stageLabel} (Running)
              </Badge>
            )
          ) : (
            <Badge
              variant={
                campaign.status === "done" ||
                campaign.status === "awaiting_approval"
                  ? "neutral"
                  : "neutral"
              }
              className="self-start px-3 py-1 capitalize sm:self-auto">
              {stageLabel}
            </Badge>
          )}

          {inngestOffline && (
            <Badge
              variant="warning"
              className="gap-1"
              title="Inngest dev server is not running on port 8288">
              <AlertCircle className="size-3 text-warning" />
              Inngest Offline
            </Badge>
          )}

          {counts.approved > 0 && campaign.currentStage !== "send_emails" && (
            <Button variant="brand"
              size="md"
              onClick={startSending}
              disabled={isDispatching || !mailbox}
              className="gap-1.5"
            >
              {isDispatching ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
              Start Sending ({counts.approved})
            </Button>
          )}

          {campaign.status !== "in_progress" &&
            campaign.status !== "failed" && (
              <Button
                variant="outline"
                size="md"
                onClick={restartPipeline}
                disabled={isRestarting}
                className="gap-1.5"
                title="Restart or re-run autonomous research pipeline"
              >
                {isRestarting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="size-3.5" />
                )}
                Re-run
              </Button>
            )}
        </div>
      </div>
    </div>
  )
}

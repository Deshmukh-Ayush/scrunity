"use client"

import Link from "next/link"
import { AlertCircle, ArrowLeft, Loader2, RotateCcw, Send } from "lucide-react"
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
                variant="outline"
                className="gap-1.5 self-start border-amber-500/50 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600 capitalize sm:self-auto dark:text-amber-400"
              >
                <AlertCircle className="size-3 text-amber-500" />
                {stageLabel} (Stalled)
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="gap-1.5 self-start border-tertiary/40 bg-tertiary/10 px-3 py-1 text-xs text-tertiary capitalize sm:self-auto"
              >
                <Loader2 className="size-3 animate-spin" />
                {stageLabel} (Running)
              </Badge>
            )
          ) : (
            <Badge
              variant={
                campaign.status === "done" ||
                campaign.status === "awaiting_approval"
                  ? "default"
                  : "secondary"
              }
              className="self-start px-3 py-1 text-xs capitalize sm:self-auto"
            >
              {stageLabel}
            </Badge>
          )}

          {inngestOffline && (
            <Badge
              variant="outline"
              className="gap-1 border-amber-500/40 bg-amber-500/5 text-xs text-amber-600 dark:text-amber-400"
              title="Inngest dev server is not running on port 8288"
            >
              <AlertCircle className="size-3 text-amber-500" />
              Inngest Offline
            </Badge>
          )}

          {counts.approved > 0 && campaign.currentStage !== "send_emails" && (
            <Button
              size="sm"
              onClick={startSending}
              disabled={isDispatching || !mailbox}
              className="h-8 gap-1.5 text-xs shadow-sm"
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
                size="sm"
                onClick={restartPipeline}
                disabled={isRestarting}
                className="h-8 gap-1.5 text-xs"
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

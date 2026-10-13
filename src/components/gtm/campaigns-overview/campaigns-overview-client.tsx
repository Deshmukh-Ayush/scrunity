"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Plus, RefreshCw, Sparkles } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { SegmentDigestCard } from "../segment-digest-card"
import { ActiveCampaignCard } from "./active-campaign-card"
import { ResearchRunCard } from "./research-run-card"
import { ResearchRunDetailCard } from "./research-run-detail-card"
import type { CampaignItem, ResearchRunDetail, ResearchRunItem } from "./types"

const POLL_INTERVAL_MS = 6000

/**
 * /dashboard/campaigns body. Starts from server-fetched runs and campaigns, then
 * polls both list routes so stage changes show up without a reload.
 */
export function CampaignsOverviewClient({
  initialRuns,
  initialCampaigns,
}: {
  initialRuns: ResearchRunItem[]
  initialCampaigns: CampaignItem[]
}) {
  const [runs, setRuns] = React.useState(initialRuns)
  const [campaigns, setCampaigns] = React.useState(initialCampaigns)
  const [activeRunDetail, setActiveRunDetail] =
    React.useState<ResearchRunDetail | null>(null)
  const [startingSegmentId, setStartingSegmentId] = React.useState<
    string | null
  >(null)

  const fetchData = React.useCallback(async () => {
    try {
      const [runsRes, campaignsRes] = await Promise.all([
        fetch("/api/gtm/research-runs"),
        fetch("/api/gtm/campaigns"),
      ])
      const [runsData, campaignsData] = await Promise.all([
        runsRes.json(),
        campaignsRes.json(),
      ])

      if (runsData.runs) setRuns(runsData.runs)
      if (campaignsData.campaigns) setCampaigns(campaignsData.campaigns)
    } catch (e) {
      console.error("Failed to load GTM data:", e)
    }
  }, [])

  React.useEffect(() => {
    const interval = setInterval(fetchData, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchData])

  const inspectRun = async (runId: string) => {
    try {
      const res = await fetch(`/api/gtm/research-runs/${runId}`)
      const data = await res.json()
      if (data.success) setActiveRunDetail(data)
    } catch {
      toast.error("Failed to load research run details")
    }
  }

  const handleStartCampaign = async (icpSegmentId: string) => {
    setStartingSegmentId(icpSegmentId)
    try {
      const res = await fetch("/api/gtm/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icpSegmentId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to start campaign")

      toast.success("Outreach campaign launched for this segment!")
      await fetchData()
      if (activeRunDetail?.researchRun?.id) {
        await inspectRun(activeRunDetail.researchRun.id)
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to start campaign")
    } finally {
      setStartingSegmentId(null)
    }
  }

  // One digest per ICP segment, even when a segment has several campaigns.
  const campaignPerSegment = Array.from(
    new Map(campaigns.map((c) => [c.campaign.icpSegmentId, c])).values()
  )

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            GTM Campaigns & Research
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Autonomous market research, competitor benchmarking, ICP generation,
            and cold outreach.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            className="gap-1.5"
          >
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
          <Link
            href="/dashboard/campaigns/new"
            className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
          >
            <Plus className="size-4" />
            New Research Run
          </Link>
        </div>
      </div>

      {campaigns.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold tracking-wide text-foreground uppercase">
            Active Outreach Campaigns
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((item) => (
              <ActiveCampaignCard key={item.campaign.id} {...item} />
            ))}
          </div>
        </div>
      )}

      {campaigns.length > 0 && (
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-foreground uppercase">
              Segment Performance & Learning Digests
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Periodic performance digests to evaluate ICP conversion and double
              down on what works.
            </p>
          </div>
          <div className="space-y-3">
            {campaignPerSegment.map(({ campaign, researchRun }) => (
              <SegmentDigestCard
                key={campaign.icpSegmentId}
                segmentId={campaign.icpSegmentId}
                segmentName={`${researchRun.companyName} ICP Segment`}
              />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-sm font-semibold tracking-wide text-foreground uppercase">
          Company Research Runs
        </h2>
        {runs.length === 0 ? (
          <Card className="border-dashed p-8 text-center">
            <div className="flex flex-col items-center justify-center space-y-3">
              <Sparkles className="size-8 text-muted-foreground" />
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-foreground">
                  No research runs yet
                </h3>
                <p className="max-w-sm text-xs text-muted-foreground">
                  Start by providing your company website. Our autonomous agent
                  will analyze your product, map competitors, and propose
                  verified ICP segments.
                </p>
              </div>
              <Link
                href="/dashboard/campaigns/new"
                className={cn(buttonVariants({ size: "sm" }), "mt-2 gap-1.5")}
              >
                <Plus className="size-4" />
                Launch First Research Run
              </Link>
            </div>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {runs.map((run) => (
              <ResearchRunCard key={run.id} run={run} onSelect={inspectRun} />
            ))}
          </div>
        )}
      </div>

      {activeRunDetail && (
        <ResearchRunDetailCard
          detail={activeRunDetail}
          startingSegmentId={startingSegmentId}
          onStartCampaign={handleStartCampaign}
          onClose={() => setActiveRunDetail(null)}
        />
      )}
    </div>
  )
}

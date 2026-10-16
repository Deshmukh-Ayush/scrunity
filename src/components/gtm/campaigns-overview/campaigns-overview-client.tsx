"use client"

import * as React from "react"
import Link from "next/link"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DataTable,
  DataTableMessage,
  FilterChips,
} from "@/components/ui/data-table"
import { useUrlFilter } from "@/components/ui/data-table/use-url-filter"
import { RefreshCw } from "@/components/ui/icons"
import { useHydrated } from "@/hooks/use-hydrated"
import { cn } from "@/lib/utils"
import {
  CAMPAIGN_BUCKETS,
  bucketChips,
  campaignStatus,
} from "../pipeline-status"
import { campaignColumns, type CampaignTableRow } from "./campaign-columns"
import type { CampaignRow } from "./types"

/*
 * Parked: "Segment performance & learning digests" (SegmentDigestCard per ICP
 * segment, with Recompute digest) used to render on this page under the
 * campaign cards. It is hidden for now, not deleted: the component
 * (gtm/segment-digest-card.tsx), its routes (api/gtm/segments/[id]/digest,
 * api/gtm/digests) and the generate-digest cron are unchanged. To bring it
 * back, render <SegmentDigestCard segmentId segmentName /> once per segment.
 */

const POLL_INTERVAL_MS = 6000
const BUCKET_VALUES = CAMPAIGN_BUCKETS.map((b) => b.value)

/**
 * /dashboard/campaigns: every outreach campaign as one table, filtered by
 * status (?status=). Starts from the server-fetched rows and polls
 * GET /api/gtm/campaigns so stage changes show up without a reload.
 */
export function CampaignsOverviewClient({
  initialCampaigns,
}: {
  initialCampaigns: CampaignRow[]
}) {
  const [campaigns, setCampaigns] = React.useState(initialCampaigns)
  const [refreshing, setRefreshing] = React.useState(false)
  const [loadError, setLoadError] = React.useState(false)
  const [filter, setFilter] = useUrlFilter("status", BUCKET_VALUES)
  const hydrated = useHydrated()

  const fetchCampaigns = React.useCallback(async () => {
    try {
      const res = await fetch("/api/gtm/campaigns")
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.campaigns) setCampaigns(data.campaigns)
      setLoadError(false)
    } catch (e) {
      console.error("Failed to load campaigns:", e)
      setLoadError(true)
    }
  }, [])

  React.useEffect(() => {
    const interval = setInterval(fetchCampaigns, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchCampaigns])

  const refresh = async () => {
    setRefreshing(true)
    await fetchCampaigns()
    setRefreshing(false)
  }

  const rows: CampaignTableRow[] = React.useMemo(
    () =>
      campaigns.map((row) => ({
        ...row,
        status: campaignStatus(row.campaign, hydrated),
        // The segment (ICP) names the campaign; the old "<Company> Campaign" is the fallback.
        name: row.segmentName || `${row.researchRun.companyName} campaign`,
        lastActivity:
          row.campaign.lastProgressAt ||
          row.campaign.stageStartedAt ||
          row.campaign.createdAt,
      })),
    [campaigns, hydrated]
  )

  const chips = bucketChips(
    CAMPAIGN_BUCKETS,
    rows.map((r) => r.status)
  )
  const visible =
    filter === "all" ? rows : rows.filter((r) => r.status.bucket === filter)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-title text-fg-strong">Campaigns</h1>
          <p className="text-body text-fg-muted">
            Every outreach campaign, where it is in the pipeline and what it
            needs from you.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={refresh} loading={refreshing}>
            <RefreshCw data-icon="inline-start" />
            Refresh
          </Button>
          {/* Campaigns start from a research run's segments; this is the way in. */}
          <Link href="/dashboard/campaigns/new" className={buttonVariants()}>
            New research run
          </Link>
        </div>
      </div>

      {campaigns.length > 0 && (
        <FilterChips
          label="Filter campaigns by status"
          chips={chips}
          value={filter}
          onChange={setFilter}
          total={rows.length}
        />
      )}

      <DataTable
        label="Campaigns"
        columns={campaignColumns}
        rows={visible}
        rowKey={(row) => row.campaign.id}
        rowHref={(row) => `/dashboard/campaigns/${row.campaign.id}`}
        defaultSort={{ columnId: "activity", direction: "desc" }}
        error={
          loadError && campaigns.length === 0 ? (
            <DataTableMessage
              role="alert"
              title="Campaigns didn't load"
              description="Check your connection, then refresh."
              action={
                <Button size="sm" onClick={refresh}>
                  Refresh
                </Button>
              }
            />
          ) : undefined
        }
        empty={
          campaigns.length === 0 ? (
            <DataTableMessage
              title="No campaigns yet"
              description="Campaigns start from the segments of a research run."
              action={
                <Link
                  href="/dashboard/research"
                  className={cn(buttonVariants({ size: "sm" }))}
                >
                  Go to research
                </Link>
              }
            />
          ) : (
            <DataTableMessage
              title="No campaigns with this status"
              action={
                <Button size="sm" onClick={() => setFilter("all")}>
                  Show all campaigns
                </Button>
              }
            />
          )
        }
      />
    </div>
  )
}

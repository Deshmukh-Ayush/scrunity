"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DataTable,
  DataTableMessage,
  FilterChips,
} from "@/components/ui/data-table"
import { useUrlFilter } from "@/components/ui/data-table/use-url-filter"
import { Plus, RefreshCw } from "@/components/ui/icons"
import { useHydrated } from "@/hooks/use-hydrated"
import { cn } from "@/lib/utils"
import {
  RESEARCH_BUCKETS,
  bucketChips,
  researchStatus,
} from "../pipeline-status"
import { ResearchRunDetailCard } from "../campaigns-overview/research-run-detail-card"
import type {
  ResearchRunDetail,
  ResearchRunItem,
} from "../campaigns-overview/types"
import {
  domainOf,
  researchColumns,
  type ResearchTableRow,
} from "./research-columns"

const POLL_INTERVAL_MS = 6000
const BUCKET_VALUES = RESEARCH_BUCKETS.map((b) => b.value)
const NEW_RUN_HREF = "/dashboard/campaigns/new"

/**
 * /dashboard/research: company research runs as a table, filtered by status
 * (?status=). ?run=<id> opens that run's competitors and segments (with
 * "Start outreach" per segment) under the table, as the old campaigns page
 * did. Polls GET /api/gtm/research-runs for live status.
 */
export function ResearchOverviewClient({
  initialRuns,
}: {
  initialRuns: ResearchRunItem[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const selectedRunId = searchParams.get("run")
  const [runs, setRuns] = React.useState(initialRuns)
  const [refreshing, setRefreshing] = React.useState(false)
  const [loadError, setLoadError] = React.useState(false)
  const [detail, setDetail] = React.useState<ResearchRunDetail | null>(null)
  const [startingSegmentId, setStartingSegmentId] = React.useState<
    string | null
  >(null)
  const [filter, setFilter] = useUrlFilter("status", BUCKET_VALUES)
  const hydrated = useHydrated()
  const detailRef = React.useRef<HTMLDivElement>(null)

  const fetchRuns = React.useCallback(async () => {
    try {
      const res = await fetch("/api/gtm/research-runs")
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.runs) setRuns(data.runs)
      setLoadError(false)
    } catch (e) {
      console.error("Failed to load research runs:", e)
      setLoadError(true)
    }
  }, [])

  React.useEffect(() => {
    const interval = setInterval(fetchRuns, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchRuns])

  const loadDetail = React.useCallback(async (runId: string) => {
    try {
      const res = await fetch(`/api/gtm/research-runs/${runId}`)
      const data = await res.json()
      if (data.success) setDetail(data)
    } catch {
      toast.error("Failed to load research run details")
    }
  }, [])

  // Follow ?run=: load the run's segments and bring them into view.
  React.useEffect(() => {
    if (!selectedRunId) return
    let cancelled = false
    fetch(`/api/gtm/research-runs/${selectedRunId}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data.success) return
        setDetail(data)
        requestAnimationFrame(() =>
          detailRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          })
        )
      })
      .catch(() => toast.error("Failed to load research run details"))
    return () => {
      cancelled = true
    }
  }, [selectedRunId])

  const closeDetail = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("run")
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
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
      await fetchRuns()
      if (detail?.researchRun?.id) await loadDetail(detail.researchRun.id)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to start campaign"
      )
    } finally {
      setStartingSegmentId(null)
    }
  }

  const refresh = async () => {
    setRefreshing(true)
    await fetchRuns()
    setRefreshing(false)
  }

  const rows: ResearchTableRow[] = React.useMemo(
    () =>
      runs.map((run) => ({
        ...run,
        display: researchStatus(run, hydrated),
        domain: domainOf(run.websiteUrl),
      })),
    [runs, hydrated]
  )
  const chips = bucketChips(
    RESEARCH_BUCKETS,
    rows.map((r) => r.display)
  )
  const visible =
    filter === "all" ? rows : rows.filter((r) => r.display.bucket === filter)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-title text-fg-strong">Research</h1>
          <p className="text-body text-fg-muted">
            What the agent learned about each company: its competitors and the
            segments worth reaching.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={refresh} loading={refreshing}>
            <RefreshCw data-icon="inline-start" />
            Refresh
          </Button>
          <Link
            href={NEW_RUN_HREF}
            className={buttonVariants({ variant: "brand" })}
          >
            <Plus data-icon="inline-start" />
            New research run
          </Link>
        </div>
      </div>

      {runs.length > 0 && (
        <FilterChips
          label="Filter research runs by status"
          chips={chips}
          value={filter}
          onChange={setFilter}
          total={rows.length}
        />
      )}

      <DataTable
        label="Research runs"
        columns={researchColumns}
        rows={visible}
        rowKey={(row) => row.id}
        rowHref={(row) => `/dashboard/research?run=${row.id}`}
        defaultSort={{ columnId: "started", direction: "desc" }}
        error={
          loadError && runs.length === 0 ? (
            <DataTableMessage
              role="alert"
              title="Research runs didn't load"
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
          runs.length === 0 ? (
            <DataTableMessage
              title="No research runs yet"
              description="Give the agent your company website and it maps your competitors and best segments."
              action={
                <Link
                  href={NEW_RUN_HREF}
                  className={cn(buttonVariants({ size: "sm" }))}
                >
                  Start a research run
                </Link>
              }
            />
          ) : (
            <DataTableMessage
              title="No research runs with this status"
              action={
                <Button size="sm" onClick={() => setFilter("all")}>
                  Show all research runs
                </Button>
              }
            />
          )
        }
      />

      <div ref={detailRef} className="scroll-mt-4">
        {/* Shown only while it matches ?run=, so closing or going back hides it. */}
        {detail && detail.researchRun.id === selectedRunId && (
          <ResearchRunDetailCard
            detail={detail}
            startingSegmentId={startingSegmentId}
            onStartCampaign={handleStartCampaign}
            onClose={closeDetail}
          />
        )}
      </div>
    </div>
  )
}

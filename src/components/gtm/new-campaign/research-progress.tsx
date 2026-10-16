"use client"

import { Building2, RotateCcw, Search, Target } from "@/components/ui/icons"
import { Button } from "@/components/ui/button"
import {
  ProcessActivity,
  ProcessCard,
  ProcessFooter,
  ProcessProgress,
  ProcessStages,
} from "@/components/ui/process-card"
import { checkStageStaleness } from "@/lib/gtm-staleness"
import { formatTargetMarket } from "@/lib/geo/countries"
import { useHydrated } from "@/hooks/use-hydrated"
import { CompanyTile } from "../process/company-tile"
import { deriveResearchProcess, RESEARCH_STAGES } from "../process/research-process"
import type { Competitor, IcpSegment, ResearchRunDetails } from "./types"

const STAGE_ICONS = [
  <Building2 key="company" className="size-4" />,
  <Search key="competitors" className="size-4" />,
  <Target key="segments" className="size-4" />,
]

const hostOf = (url: string) => url.replace(/^(?:https?:\/*)+/i, "").replace(/\/.*$/, "")

/**
 * Step 2: the research run as a ProcessCard (three stages), from the polled
 * run row. Restart and re-run are the only controls, because they are the
 * only ones that exist. Research runs on the server, so leaving is safe.
 */
export function ResearchProgress({
  runDetails,
  fallbackCompanyName,
  fallbackWebsiteUrl,
  logoPreview,
  competitors,
  segments,
  isRestarting,
  onRestartStage,
  onRetryResearch,
  motion,
}: {
  runDetails: ResearchRunDetails | null
  fallbackCompanyName: string
  fallbackWebsiteUrl: string
  logoPreview: string | null
  competitors: Competitor[]
  segments: IcpSegment[]
  isRestarting: boolean
  onRestartStage: () => void
  onRetryResearch: () => void
  /** Testing route only: force reduced motion. */
  motion?: "auto" | "reduce"
}) {
  const hydrated = useHydrated()
  const companyName = runDetails?.companyName || fallbackCompanyName
  const website = hostOf(runDetails?.websiteUrl || fallbackWebsiteUrl)
  const staleness = hydrated
    ? checkStageStaleness({
        stage: runDetails?.currentStage || "research_company",
        status: runDetails?.status || "in_progress",
        stageStartedAt: runDetails?.stageStartedAt,
        lastProgressAt: runDetails?.lastProgressAt,
        createdAt: runDetails?.createdAt,
      })
    : null

  const process = deriveResearchProcess({
    status: runDetails?.status || "in_progress",
    currentStage: runDetails?.currentStage || "research_company",
    failureReason: runDetails?.failureReason,
    companyName,
    hasProfile: Boolean(runDetails?.synthesizedProfile),
    competitorNames: competitors.map((c) => c.name),
    segmentCount: segments.length,
    stalledForMs: staleness?.isStalled ? staleness.elapsedMs : null,
  })
  const market = formatTargetMarket(runDetails?.targetCountryCode, runDetails?.targetRegion)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-title text-fg-strong">Researching {companyName}</h1>
        <p className="text-body text-fg-muted">
          This usually takes a few minutes. You can leave this page: research
          keeps running, and the results wait for you under Research.
        </p>
      </div>

      <ProcessCard
        state={process.state}
        title={companyName}
        leading={<CompanyTile name={companyName} logoUrl={runDetails?.logoUrl || logoPreview} />}
        pill={process.pill}
        meta={market ? `${website} · Selling in ${market}` : website}
        startedAt={runDetails?.createdAt}
        announcement={process.announcement}
        motion={motion}
      >
        <ProcessStages
          label="Research steps"
          current={process.current}
          stages={RESEARCH_STAGES.map((s, i) => ({
            id: s.id,
            label: s.label,
            icon: STAGE_ICONS[i],
            detail: process.details[i],
          }))}
        />
        {(process.state === "running" || process.state === "done") && (
          <ProcessProgress
            label={process.state === "done" ? "All three steps are done" : `Working on: ${RESEARCH_STAGES[process.current].label}`}
          />
        )}
        <ProcessActivity items={process.activity} />
        <ProcessFooter status={process.status}>
          {process.state === "stalled" && (
            <Button onClick={onRestartStage} loading={isRestarting}>
              <RotateCcw data-icon="inline-start" />
              Restart step
            </Button>
          )}
          {(process.state === "failed" || process.state === "no-results") && (
            <Button onClick={onRetryResearch} loading={isRestarting}>
              <RotateCcw data-icon="inline-start" />
              Run research again
            </Button>
          )}
        </ProcessFooter>
      </ProcessCard>
    </div>
  )
}

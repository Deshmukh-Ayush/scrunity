"use client"

import {
  AlertCircle,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Globe,
  Loader2,
  RotateCcw,
  Search,
  Target,
} from "@/components/ui/icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { checkStageStaleness } from "@/lib/gtm-staleness"
import type { Competitor, IcpSegment, ResearchRunDetails } from "./types"

function buildTimeline(
  stage: string,
  runDone: boolean,
  competitorCount: number,
  segmentCount: number
) {
  const pastCompetitors = stage === "define_segments" || stage === "done"
  const segmentsDone = stage === "done" || runDone
  return [
    {
      id: "stage-1",
      title: "Stage 1: Research Company",
      description:
        "Scraping homepage, extracting SEO keywords, and discovering social profiles (LinkedIn, X, Instagram).",
      stageKey: "research_company",
      isComplete: stage !== "research_company",
      isActive: stage === "research_company",
      summary:
        stage !== "research_company"
          ? "Website branding and social channels analyzed."
          : "Scraping homepage and searching social presence...",
      icon: Building2,
    },
    {
      id: "stage-2",
      title: "Stage 2: Explore Competitors",
      description:
        "Generating search queries, scanning commercial web via Firecrawl, and filtering aggregator directories.",
      stageKey: "research_competitors",
      isComplete: pastCompetitors,
      isActive: stage === "research_competitors",
      summary: pastCompetitors
        ? `Identified and benchmarked ${competitorCount} commercial competitors.`
        : "Generating queries and benchmarking competitors...",
      icon: Search,
    },
    {
      id: "stage-3",
      title: "Stage 3: Define ICP Segments",
      description:
        "Deriving 4-6 Ideal Customer Profile segments, acute pain points, and discovering real example companies.",
      stageKey: "define_segments",
      isComplete: segmentsDone,
      isActive: stage === "define_segments",
      summary: segmentsDone
        ? `Generated ${segmentCount} verified ICP segments.`
        : "Formulating ICP targets and discovering example companies...",
      icon: Target,
    },
  ]
}

/** Step 2: live timeline of research stages 1-3, with stall and failure recovery. */
export function ResearchProgress({
  runDetails,
  fallbackCompanyName,
  fallbackWebsiteUrl,
  logoPreview,
  competitors,
  segments,
  errorMessage,
  isRestarting,
  onRestartStage,
  onRetryResearch,
}: {
  runDetails: ResearchRunDetails | null
  fallbackCompanyName: string
  fallbackWebsiteUrl: string
  logoPreview: string | null
  competitors: Competitor[]
  segments: IcpSegment[]
  errorMessage: string | null
  isRestarting: boolean
  onRestartStage: () => void
  onRetryResearch: () => void
}) {
  const currentStage = runDetails?.currentStage || "research_company"
  const staleness = checkStageStaleness({
    stage: currentStage,
    status: runDetails?.status || "in_progress",
    stageStartedAt: runDetails?.stageStartedAt,
    lastProgressAt: runDetails?.lastProgressAt,
    createdAt: runDetails?.createdAt,
  })
  const timeline = buildTimeline(
    currentStage,
    runDetails?.status === "done",
    competitors.length,
    segments.length
  )
  const hasFailed = Boolean(errorMessage) || runDetails?.status === "failed"

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Autonomous Market Research in Progress
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Analyzing {runDetails?.companyName || fallbackCompanyName} (
            {runDetails?.websiteUrl || fallbackWebsiteUrl})
          </p>
        </div>
        {logoPreview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoPreview}
            alt="Logo"
            className="size-10 rounded-lg border bg-background object-contain p-1"
          />
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <span>Pipeline Execution Timeline</span>
            <Badge variant="neutral" className="gap-1 font-normal">
              <Loader2 className="size-3 animate-spin text-primary" />
              Live Inngest Pipeline
            </Badge>
          </CardTitle>
          <CardDescription>
            Each stage executes asynchronously, discovering data and feeding the
            next stage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="relative ml-1 space-y-2 py-2">
            {timeline.map((step, idx) => {
              const isLast = idx === timeline.length - 1
              const StepIcon = step.icon
              const state = step.isComplete
                ? "complete"
                : step.isActive
                  ? "active"
                  : "pending"

              return (
                <li
                  key={step.id}
                  data-state={state}
                  className="relative flex gap-4"
                >
                  <div className="relative flex flex-col items-center">
                    <div
                      className={cn(
                        "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors",
                        state === "complete" &&
                          "border-success-border bg-success-tint text-success",
                        state === "active" &&
                          "border-primary/40 bg-primary/10 text-primary",
                        state === "pending" &&
                          "border-border/60 bg-muted text-muted-foreground"
                      )}
                    >
                      {state === "complete" ? (
                        <CheckCircle2 className="size-4" />
                      ) : state === "active" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <StepIcon className="size-4" />
                      )}
                    </div>
                    {!isLast && (
                      <div
                        aria-hidden="true"
                        className={cn(
                          "absolute top-8 bottom-0 left-1/2 w-px -translate-x-1/2 border-l border-dashed transition-colors",
                          step.isComplete
                            ? "border-success-border"
                            : "border-border/60"
                        )}
                      />
                    )}
                  </div>

                  <div
                    className={cn("min-w-0 flex-1", isLast ? "pb-2" : "pb-6")}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {step.title}
                      </span>
                      {step.isActive && (
                        <Badge
                          variant={
                            staleness.isStalled ? "neutral" : "neutral"
                          }
                          className={cn(
                            "py-0 text-[10px]",
                            staleness.isStalled &&
                              "border-warning-border bg-warning-tint font-medium text-warning"
                          )}>
                          {staleness.isStalled ? "Stalled" : "In Progress"}
                        </Badge>
                      )}
                      {step.isComplete && (
                        <Badge
                          variant="success"
                          className="py-0">
                          Completed
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {step.description}
                    </p>
                    <div className="mt-2 rounded bg-muted/30 p-2 font-mono text-xs text-foreground shadow-surface">
                      {step.summary}
                    </div>

                    {step.stageKey === "research_competitors" &&
                      competitors.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {competitors.slice(0, 5).map((c) => (
                            <Badge
                              key={c.id}
                              variant="neutral"
                              className="gap-1">
                              <Globe className="size-3 text-muted-foreground" />
                              {c.name}
                            </Badge>
                          ))}
                          {competitors.length > 5 && (
                            <Badge variant="neutral">
                              +{competitors.length - 5} more
                            </Badge>
                          )}
                        </div>
                      )}
                  </div>
                </li>
              )
            })}
          </ol>

          {staleness.isStalled && !hasFailed && (
            <div className="mt-6 flex flex-col items-center justify-center gap-3 rounded-lg border border-warning-border bg-warning-tint p-4 text-center">
              <div className="flex items-center gap-2 text-xs font-medium text-warning">
                <AlertTriangle className="size-4 shrink-0 text-warning" />
                <span>
                  Autonomous Pipeline Stalled: {staleness.explanation}
                </span>
              </div>
              <Button
                variant="outline"
                size="md"
                onClick={onRestartStage}
                disabled={isRestarting}
                className="gap-1.5"
              >
                {isRestarting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="size-3.5" />
                )}
                Restart Stage
              </Button>
            </div>
          )}

          {hasFailed && (
            <div className="mt-6 flex flex-col items-center justify-center gap-3 rounded-lg bg-danger-tint p-4 text-center shadow-surface">
              <div className="flex items-center gap-2 text-xs font-medium text-danger">
                <AlertCircle className="size-4 shrink-0" />
                <span>
                  {errorMessage ||
                    "Autonomous pipeline encountered an issue. You can retry."}
                </span>
              </div>
              <Button
                variant="outline"
                size="md"
                onClick={onRetryResearch}
                disabled={isRestarting}
                className="gap-1.5"
              >
                {isRestarting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <RotateCcw className="size-3.5" />
                )}
                Retry Research Pipeline
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

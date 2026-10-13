"use client"

import {
  Building2,
  CheckCircle2,
  Globe,
  Loader2,
  Search,
  Target,
} from "lucide-react"
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

export type SimulatedStage = 1 | 2 | 3 | 4

function stageSummaries(stage: SimulatedStage, competitorCount: number) {
  return [
    stage > 1
      ? "Homepage analyzed. Discovered LinkedIn company page and active brand presence."
      : "Scraping homepage and searching social presence...",
    stage >= 2
      ? `Identified and benchmarked ${competitorCount} commercial competitors.`
      : "Waiting for company research...",
    stage === 3
      ? "Formulating segments and verifying candidate company websites..."
      : stage > 3
        ? "Generated 4 verified ICP segments."
        : "Waiting for competitor analysis...",
  ]
}

const STAGES = [
  {
    title: "Stage 1: Research Company",
    description:
      "Scraping homepage, extracting SEO keywords, and discovering social profiles (LinkedIn, X, Instagram).",
    icon: Building2,
  },
  {
    title: "Stage 2: Explore Competitors",
    description:
      "Generating search queries, querying Firecrawl, and filtering aggregator directories.",
    icon: Search,
  },
  {
    title: "Stage 3: Define ICP Segments",
    description:
      "Deriving 4–6 Ideal Customer Profile segments with acute pain points and qualification criteria.",
    icon: Target,
  },
]

/**
 * Onboarding step 2. DEMO: a timer-driven timeline, not the real pipeline
 * (see demo-data.ts).
 */
export function SimulatedResearch({
  stage,
  companyName,
  websiteUrl,
  logoUrl,
  competitors,
  onSkip,
}: {
  stage: SimulatedStage
  companyName: string
  websiteUrl: string
  logoUrl: string | null
  competitors: string[]
  onSkip: () => void
}) {
  const summaries = stageSummaries(stage, competitors.length)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Autonomous Research in Progress
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Analyzing {companyName} ({websiteUrl})
          </p>
        </div>
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt="Logo"
            className="size-10 rounded-lg border bg-background object-contain p-1"
          />
        )}
      </div>

      <Card>
        <CardHeader className="p-6 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <span>Pipeline Execution Timeline</span>
            </CardTitle>
            <Badge variant="outline" className="gap-1 text-xs font-normal">
              <Loader2 className="size-3 animate-spin text-primary" />
              Live Pipeline
            </Badge>
          </div>
          <CardDescription>
            Stages execute sequentially, discovering live market intelligence
            and structuring ICP targets.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 pt-2">
          <ol className="relative ml-1 space-y-3 py-2">
            {STAGES.map((s, idx) => {
              const n = idx + 1
              const state =
                stage > n ? "complete" : stage === n ? "active" : "pending"
              const isLast = idx === STAGES.length - 1
              const Icon = s.icon

              return (
                <li key={s.title} className="relative flex gap-4">
                  <div className="relative flex flex-col items-center">
                    <div
                      className={cn(
                        "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors",
                        state === "complete" &&
                          "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
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
                        <Icon className="size-4" />
                      )}
                    </div>
                    {!isLast && (
                      <div
                        aria-hidden="true"
                        className={cn(
                          "absolute top-8 bottom-0 left-1/2 w-px -translate-x-1/2 border-l border-dashed transition-colors",
                          state === "complete"
                            ? "border-emerald-500/40"
                            : "border-border/60"
                        )}
                      />
                    )}
                  </div>

                  <div className={cn("min-w-0 flex-1", !isLast && "pb-6")}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {s.title}
                      </span>
                      {state === "active" && (
                        <Badge variant="secondary" className="py-0 text-[10px]">
                          In Progress
                        </Badge>
                      )}
                      {state === "complete" && (
                        <Badge
                          variant="outline"
                          className="border-emerald-500/30 py-0 text-[10px] text-emerald-600 dark:text-emerald-400"
                        >
                          Completed
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {s.description}
                    </p>
                    <div className="mt-2 rounded border border-border/40 bg-muted/30 p-2 font-mono text-xs text-foreground">
                      {summaries[idx]}
                    </div>

                    {n === 2 && competitors.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {competitors.map((name) => (
                          <Badge
                            key={name}
                            variant="outline"
                            className="gap-1 text-[11px]"
                          >
                            <Globe className="size-3 text-muted-foreground" />
                            {name}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>

          <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
            <span>Stages progressing automatically...</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onSkip}
              className="h-7 gap-1 text-xs"
            >
              Skip to Profile Review →
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

import { ArrowRight, Building2 } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { checkStageStaleness } from "@/lib/gtm-staleness"
import { useHydrated } from "@/hooks/use-hydrated"
import { LocalDate } from "@/components/ui/local-date"
import type { ResearchRunItem } from "./types"

/** Clickable summary of one research run; selecting it opens the run's segments. */
export function ResearchRunCard({
  run,
  onSelect,
}: {
  run: ResearchRunItem
  onSelect: (runId: string) => void
}) {
  const hydrated = useHydrated()
  // Staleness depends on the current time, so it is only evaluated after hydration.
  const staleness = hydrated
    ? checkStageStaleness({
        stage: run.currentStage,
        status: run.status,
        stageStartedAt: run.stageStartedAt,
        lastProgressAt: run.lastProgressAt,
        createdAt: run.createdAt,
      })
    : { isStalled: false }
  const stageLabel = run.currentStage.replace(/_/g, " ")

  return (
    <Card
      role="button"
      tabIndex={0}
      data-stalled={staleness.isStalled || undefined}
      className={cn(
        "cursor-pointer transition-all hover:border-foreground/25",
        "data-[stalled]:border-amber-500/50 data-[stalled]:bg-amber-500/5"
      )}
      onClick={() => onSelect(run.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect(run.id)
        }
      }}
    >
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between">
          <Badge
            variant={run.status === "done" ? "default" : "secondary"}
            className={cn(
              "text-xs capitalize",
              staleness.isStalled &&
                "border-amber-500/50 bg-amber-500/10 font-medium text-amber-600 dark:text-amber-400"
            )}
          >
            {staleness.isStalled
              ? `Stalled (${stageLabel})`
              : run.status === "done"
                ? "Completed"
                : stageLabel}
          </Badge>
          <span className="text-[11px] text-muted-foreground">
            <LocalDate value={run.createdAt} />
          </span>
        </div>
        <CardTitle className="mt-2 flex items-center gap-2 text-base">
          <Building2 className="size-4 text-muted-foreground" />
          {run.companyName}
        </CardTitle>
        <CardDescription className="truncate text-xs">
          {run.websiteUrl}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {run.companyDescription}
        </p>
        <div className="mt-3 flex items-center justify-between border-t pt-2 text-xs">
          <span className="font-medium text-primary">
            Click to view segments
          </span>
          <ArrowRight className="size-3 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  )
}

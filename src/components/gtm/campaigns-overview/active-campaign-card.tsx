import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { checkStageStaleness } from "@/lib/gtm-staleness"
import { useHydrated } from "@/hooks/use-hydrated"
import { LocalDate } from "@/components/ui/local-date"
import type { CampaignItem } from "./types"

/** One in-flight outreach campaign, flagged when stalled or waiting on review. */
export function ActiveCampaignCard({ campaign, researchRun }: CampaignItem) {
  const hydrated = useHydrated()
  // Staleness depends on the current time, so it is only evaluated after hydration.
  const staleness = hydrated
    ? checkStageStaleness({
        stage: campaign.currentStage,
        status: campaign.status,
        stageStartedAt: campaign.stageStartedAt,
        lastProgressAt: campaign.lastProgressAt,
        createdAt: campaign.createdAt,
      })
    : { isStalled: false }

  const isAwaitingApproval =
    campaign.currentStage === "awaiting_approval" ||
    campaign.status === "awaiting_approval"
  const stageLabel = campaign.currentStage.replace(/_/g, " ")

  return (
    <Card
      data-stalled={staleness.isStalled || undefined}
      data-awaiting-review={isAwaitingApproval || undefined}
      className={cn(
        "transition-all hover:border-foreground/20",
        "data-[stalled]:border-amber-500/50 data-[stalled]:bg-amber-500/5",
        "data-[awaiting-review]:border-amber-500/40"
      )}
    >
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between">
          <Badge
            variant={isAwaitingApproval ? "default" : "outline"}
            className={cn(
              "text-xs capitalize",
              staleness.isStalled &&
                "border-amber-500/50 bg-amber-500/10 font-medium text-amber-600 dark:text-amber-400",
              isAwaitingApproval && "bg-amber-600 text-white hover:bg-amber-700"
            )}
          >
            {staleness.isStalled
              ? `Stalled (${stageLabel})`
              : isAwaitingApproval
                ? "Awaiting Review"
                : stageLabel}
          </Badge>
          <span className="text-[11px] text-muted-foreground">
            <LocalDate value={campaign.createdAt} />
          </span>
        </div>
        <CardTitle className="mt-2 truncate text-base">
          {researchRun.companyName} Campaign
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between p-4 pt-2">
        <span className="text-xs text-muted-foreground">
          Status: {campaign.status}
        </span>
        <Link
          href={`/dashboard/campaigns/${campaign.id}`}
          className={cn(
            buttonVariants({
              size: "sm",
              variant: isAwaitingApproval ? "default" : "secondary",
            }),
            "gap-1 text-xs",
            isAwaitingApproval && "bg-amber-600 text-white hover:bg-amber-700"
          )}
        >
          {isAwaitingApproval ? "Review Drafts" : "View Pipeline"}
          <ArrowRight className="size-3" />
        </Link>
      </CardContent>
    </Card>
  )
}

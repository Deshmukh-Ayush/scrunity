"use client"

import * as React from "react"
import Link from "next/link"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  Plus,
  RefreshCw,
  ArrowRight,
  Target,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Send,
  Building2,
} from "lucide-react"
import { checkStageStaleness } from "@/lib/gtm-staleness"
import { useHydrated } from "@/hooks/use-hydrated"
import { LocalDate } from "@/components/ui/local-date"

export interface CampaignItem {
  campaign: {
    id: string
    icpSegmentId: string
    researchRunId: string
    status: string
    currentStage: string
    createdAt: string
    stageStartedAt?: string | null
    lastProgressAt?: string | null
  }
  researchRun: {
    id: string
    companyName: string
    websiteUrl: string
  }
}

const POLL_INTERVAL_MS = 8000

/**
 * Campaign table for the dashboard home. Renders the server-fetched campaigns
 * immediately, then polls GET /api/gtm/campaigns to keep pipeline stages live.
 */
export function CampaignsListClient({
  initialCampaigns,
}: {
  initialCampaigns: CampaignItem[]
}) {
  const [campaigns, setCampaigns] =
    React.useState<CampaignItem[]>(initialCampaigns)
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const hydrated = useHydrated()

  // Staleness depends on the current time, so it is only evaluated after hydration.
  const isStalled = (campaign: CampaignItem["campaign"]) =>
    hydrated &&
    checkStageStaleness({
      stage: campaign.currentStage,
      status: campaign.status,
      stageStartedAt: campaign.stageStartedAt,
      lastProgressAt: campaign.lastProgressAt,
      createdAt: campaign.createdAt,
    }).isStalled

  const fetchCampaigns = async () => {
    try {
      const res = await fetch("/api/gtm/campaigns")
      const data = await res.json()
      if (data.campaigns) {
        setCampaigns(data.campaigns)
      }
    } catch (e) {
      console.error("Failed to load campaigns:", e)
    } finally {
      setIsRefreshing(false)
    }
  }

  React.useEffect(() => {
    const interval = setInterval(fetchCampaigns, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  const handleManualRefresh = () => {
    setIsRefreshing(true)
    fetchCampaigns()
  }

  const getStageBadge = (campaign: CampaignItem["campaign"]) => {
    if (isStalled(campaign)) {
      return (
        <Badge
          variant="outline"
          className="gap-1 border-amber-500/50 bg-amber-500/10 text-xs font-medium text-amber-600 dark:text-amber-400"
        >
          <AlertCircle className="size-3 text-amber-500" /> Stalled (
          {campaign.currentStage.replace(/_/g, " ")})
        </Badge>
      )
    }

    switch (campaign.currentStage) {
      case "find_companies":
        return (
          <Badge variant="secondary" className="gap-1 text-xs">
            <Building2 className="size-3" /> Finding Companies
          </Badge>
        )
      case "awaiting_company_selection":
        return (
          <Badge variant="outline" className="gap-1 border-amber-500/40 text-xs text-amber-700 dark:text-amber-300">
            <AlertCircle className="size-3" /> Choose Companies
          </Badge>
        )
      case "find_contacts":
        return (
          <Badge variant="secondary" className="gap-1 text-xs">
            <Target className="size-3" /> Finding Contacts
          </Badge>
        )
      case "write_emails":
        return (
          <Badge variant="secondary" className="gap-1 text-xs">
            <Sparkles className="size-3" /> Drafting Emails
          </Badge>
        )
      case "awaiting_approval":
        return (
          <Badge
            variant="default"
            className="animate-pulse gap-1 bg-amber-600 text-xs font-medium text-white hover:bg-amber-700"
          >
            <AlertCircle className="size-3" /> Awaiting Review
          </Badge>
        )
      case "send_emails":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-tertiary/30 bg-tertiary/10 text-xs text-tertiary"
          >
            <Send className="size-3" /> Sending Emails
          </Badge>
        )
      case "done":
      case "done_for_now":
        return (
          <Badge
            variant="outline"
            className="gap-1 border-emerald-500/30 text-xs text-emerald-600"
          >
            <CheckCircle2 className="size-3" /> Completed
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-xs capitalize">
            {campaign.currentStage.replace(/_/g, " ")}
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Outreach Campaigns
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Monitor pipeline execution, review AI-written email drafts, and
            trigger outreach.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="gap-1.5"
          >
            <RefreshCw
              className={cn("size-3.5", isRefreshing && "animate-spin")}
            />
            Refresh
          </Button>
          <Link
            href="/dashboard/campaigns/new"
            className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
          >
            <Plus className="size-4" />
            New Campaign
          </Link>
        </div>
      </div>

      {/* Campaigns Table or Empty State */}
      {campaigns.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center space-y-3 p-10 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Target className="size-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-medium text-foreground">
                No outreach campaigns yet
              </h3>
              <p className="mx-auto max-w-md text-sm text-muted-foreground">
                Launch your first autonomous GTM campaign by entering your
                company website. Our agent will benchmark competitors, generate
                verified ICPs, and draft personalized cold emails.
              </p>
            </div>
            <Link
              href="/dashboard/campaigns/new"
              className={cn(buttonVariants({ size: "default" }), "mt-2 gap-2")}
            >
              <Plus className="size-4" />
              Create First Campaign
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company & Campaign</TableHead>
                <TableHead>Current Stage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map(({ campaign, researchRun }) => {
                const isAwaitingApproval =
                  campaign.currentStage === "awaiting_approval" ||
                  campaign.status === "awaiting_approval"

                return (
                  <TableRow key={campaign.id} className="hover:bg-muted/40">
                    <TableCell className="font-medium">
                      <div>
                        <div className="text-sm text-foreground">
                          {researchRun?.companyName || "Company"} Outreach
                        </div>
                        <div className="max-w-[220px] truncate text-xs text-muted-foreground">
                          {researchRun?.websiteUrl}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getStageBadge(campaign)}</TableCell>
                    <TableCell>
                      {isStalled(campaign) ? (
                        <Badge
                          variant="outline"
                          className="border-amber-500/50 bg-amber-500/10 text-xs font-medium text-amber-600 capitalize dark:text-amber-400"
                        >
                          stalled
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs capitalize">
                          {campaign.status}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <LocalDate
                        value={campaign.createdAt}
                        options={{
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {isAwaitingApproval ? (
                        <Link
                          href={`/dashboard/campaigns/${campaign.id}`}
                          className={cn(
                            buttonVariants({
                              size: "sm",
                              variant: "default",
                            }),
                            "gap-1 bg-amber-600 text-xs font-medium text-white hover:bg-amber-700"
                          )}
                        >
                          Review Drafts (Stage 6)
                          <ArrowRight className="size-3" />
                        </Link>
                      ) : (
                        <Link
                          href={`/dashboard/campaigns/${campaign.id}`}
                          className={cn(
                            buttonVariants({
                              size: "sm",
                              variant: "outline",
                            }),
                            "gap-1 text-xs"
                          )}
                        >
                          View Pipeline
                          <ArrowRight className="size-3" />
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

"use client";

import * as React from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Sparkles,
  Plus,
  ArrowRight,
  Globe,
  Loader2,
  Users,
  Building2,
  CheckCircle2,
  Mail,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";
import { SegmentDigestCard } from "./segment-digest-card";
import { checkStageStaleness } from "@/lib/gtm-staleness";

export function CampaignsOverviewClient() {
  const [runs, setRuns] = React.useState<any[]>([]);
  const [campaigns, setCampaigns] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [activeRunDetail, setActiveRunDetail] = React.useState<any | null>(null);
  const [startingSegmentId, setStartingSegmentId] = React.useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [runsRes, campaignsRes] = await Promise.all([
        fetch("/api/gtm/research-runs"),
        fetch("/api/gtm/campaigns"),
      ]);
      const [runsData, campaignsData] = await Promise.all([
        runsRes.json(),
        campaignsRes.json(),
      ]);

      if (runsData.runs) setRuns(runsData.runs);
      if (campaignsData.campaigns) setCampaigns(campaignsData.campaigns);
    } catch (e) {
      console.error("Failed to load GTM data:", e);
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 6000);
    return () => clearInterval(interval);
  }, []);

  const inspectRun = async (runId: string) => {
    try {
      const res = await fetch(`/api/gtm/research-runs/${runId}`);
      const data = await res.json();
      if (data.success) {
        setActiveRunDetail(data);
      }
    } catch (e) {
      toast.error("Failed to load research run details");
    }
  };

  const handleStartCampaign = async (icpSegmentId: string) => {
    setStartingSegmentId(icpSegmentId);
    try {
      const res = await fetch("/api/gtm/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ icpSegmentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start campaign");

      toast.success("Outreach campaign launched for this segment!");
      await fetchData();
      if (activeRunDetail?.researchRun?.id) {
        await inspectRun(activeRunDetail.researchRun.id);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to start campaign");
    } finally {
      setStartingSegmentId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            GTM Campaigns & Research
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Autonomous market research, competitor benchmarking, ICP generation, and cold outreach.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-1.5">
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

      {/* In-Flight Campaigns Section */}
      {campaigns.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold tracking-wide text-foreground uppercase">
            Active Outreach Campaigns
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {campaigns.map(({ campaign, researchRun }) => {
              const staleness = checkStageStaleness({
                stage: campaign.currentStage,
                status: campaign.status,
                stageStartedAt: campaign.stageStartedAt,
                lastProgressAt: campaign.lastProgressAt,
                createdAt: campaign.createdAt,
              });

              const isAwaitingApproval =
                campaign.currentStage === "awaiting_approval" ||
                campaign.status === "awaiting_approval";

              return (
                <Card
                  key={campaign.id}
                  className={cn(
                    "hover:border-foreground/20 transition-all",
                    staleness.isStalled && "border-amber-500/50 bg-amber-500/5",
                    isAwaitingApproval && "border-amber-500/40"
                  )}
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between">
                      <Badge
                        variant={isAwaitingApproval ? "default" : "outline"}
                        className={cn(
                          "text-xs capitalize",
                          staleness.isStalled &&
                            "border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-500/10 font-medium",
                          isAwaitingApproval &&
                            "bg-amber-600 hover:bg-amber-700 text-white"
                        )}
                      >
                        {staleness.isStalled
                          ? `Stalled (${campaign.currentStage.replace(/_/g, " ")})`
                          : isAwaitingApproval
                          ? "Awaiting Review"
                          : campaign.currentStage.replace(/_/g, " ")}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(campaign.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <CardTitle className="text-base mt-2 truncate">
                      {researchRun.companyName} Campaign
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-2 flex items-center justify-between">
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
                        isAwaitingApproval && "bg-amber-600 hover:bg-amber-700 text-white"
                      )}
                    >
                      {isAwaitingApproval ? "Review Drafts" : "View Pipeline"}
                      <ArrowRight className="size-3" />
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Segment Performance & Learning Digests Section (Stage 9) */}
      {campaigns.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold tracking-wide text-foreground uppercase">
                Segment Performance & Learning Digests
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Periodic performance digests to evaluate ICP conversion and double down on what works.
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {Array.from(
              new Map(campaigns.map((c) => [c.campaign.icpSegmentId, c])).values()
            ).map(({ campaign, researchRun }) => (
              <SegmentDigestCard
                key={campaign.icpSegmentId}
                segmentId={campaign.icpSegmentId}
                segmentName={`${researchRun.companyName} ICP Segment`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Research Runs Section */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold tracking-wide text-foreground uppercase">
          Company Research Runs
        </h2>
        {runs.length === 0 ? (
          <Card className="p-8 text-center border-dashed">
            <div className="flex flex-col items-center justify-center space-y-3">
              <Sparkles className="size-8 text-muted-foreground" />
              <div className="space-y-1">
                <h3 className="text-sm font-medium text-foreground">No research runs yet</h3>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Start by providing your company website. Our autonomous agent will analyze your
                  product, map competitors, and propose verified ICP segments.
                </p>
              </div>
              <Link
                href="/dashboard/campaigns/new"
                className={cn(buttonVariants({ size: "sm" }), "gap-1.5 mt-2")}
              >
                <Plus className="size-4" />
                Launch First Research Run
              </Link>
            </div>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {runs.map((run) => {
              const runStaleness = checkStageStaleness({
                stage: run.currentStage,
                status: run.status,
                stageStartedAt: run.stageStartedAt,
                lastProgressAt: run.lastProgressAt,
                createdAt: run.createdAt,
              });

              return (
                <Card
                  key={run.id}
                  className={cn(
                    "cursor-pointer hover:border-foreground/25 transition-all",
                    runStaleness.isStalled && "border-amber-500/50 bg-amber-500/5"
                  )}
                  onClick={() => inspectRun(run.id)}
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between">
                      <Badge
                        variant={run.status === "done" ? "default" : "secondary"}
                        className={cn(
                          "text-xs capitalize",
                          runStaleness.isStalled &&
                            "border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-500/10 font-medium"
                        )}
                      >
                        {runStaleness.isStalled
                          ? `Stalled (${run.currentStage.replace(/_/g, " ")})`
                          : run.status === "done"
                          ? "Completed"
                          : run.currentStage.replace(/_/g, " ")}
                      </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(run.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <CardTitle className="text-base mt-2 flex items-center gap-2">
                    <Building2 className="size-4 text-muted-foreground" />
                    {run.companyName}
                  </CardTitle>
                  <CardDescription className="text-xs truncate">
                    {run.websiteUrl}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {run.companyDescription}
                  </p>
                  <div className="mt-3 pt-2 border-t flex items-center justify-between text-xs">
                    <span className="text-primary font-medium">Click to view segments</span>
                    <ArrowRight className="size-3 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      </div>

      {/* Research Run Detail Inspection Modal / View */}
      {activeRunDetail && (
        <Card className="mt-6 border-primary/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="size-5 text-primary" />
                  {activeRunDetail.researchRun.companyName} Research Snapshot
                </CardTitle>
                <CardDescription className="mt-1">
                  Website: {activeRunDetail.researchRun.websiteUrl} | Stage:{" "}
                  <span className="font-semibold text-foreground">
                    {activeRunDetail.researchRun.currentStage}
                  </span>
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActiveRunDetail(null)}
              >
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Competitors Found */}
            {activeRunDetail.competitors?.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Benchmarked Competitors ({activeRunDetail.competitors.length})
                </h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {activeRunDetail.competitors.map((c: any) => (
                    <div
                      key={c.id}
                      className="border rounded-md p-2.5 text-xs bg-muted/20 space-y-1"
                    >
                      <div className="font-medium text-foreground flex items-center justify-between">
                        <span>{c.name}</span>
                        <a
                          href={`https://${c.domain}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-muted-foreground hover:text-primary"
                        >
                          <Globe className="size-3" />
                        </a>
                      </div>
                      <p className="text-muted-foreground line-clamp-2">
                        {c.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ICP Segments */}
            {activeRunDetail.segments?.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Verified ICP Segments ({activeRunDetail.segments.length})
                </h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {activeRunDetail.segments.map((seg: any) => (
                    <div
                      key={seg.id}
                      className="border rounded-lg p-3.5 space-y-2.5 bg-card hover:border-foreground/30 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-medium text-sm text-foreground">
                            {seg.name}
                          </h4>
                          <span className="text-[11px] text-muted-foreground italic">
                            Est. Size: {seg.estimatedSizeLabel || "~5,000+ companies"} (LLM estimate)
                          </span>
                        </div>
                        <Button
                          size="sm"
                          disabled={startingSegmentId === seg.id}
                          onClick={() => handleStartCampaign(seg.id)}
                          className="gap-1.5 text-xs h-7"
                        >
                          {startingSegmentId === seg.id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <Mail className="size-3" />
                          )}
                          Start Outreach
                        </Button>
                      </div>

                      <div className="text-xs space-y-1 text-muted-foreground">
                        <p>
                          <strong className="text-foreground">Pain Point:</strong>{" "}
                          {seg.painPoint}
                        </p>
                        {seg.criteria && seg.criteria.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {seg.criteria.map((cr: string, i: number) => (
                              <Badge key={i} variant="outline" className="text-[10px] py-0">
                                {cr}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {seg.exampleCompanies && seg.exampleCompanies.length > 0 && (
                          <p className="text-[11px] pt-1 text-foreground/80">
                            <strong>Live Examples:</strong>{" "}
                            {seg.exampleCompanies.map((ex: any) => ex.name).join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

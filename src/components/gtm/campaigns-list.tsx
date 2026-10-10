"use client";

import * as React from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Plus,
  RefreshCw,
  ArrowRight,
  Target,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  Building2,
} from "lucide-react";

interface CampaignItem {
  campaign: {
    id: string;
    icpSegmentId: string;
    researchRunId: string;
    status: string;
    currentStage: string;
    createdAt: string;
  };
  researchRun: {
    id: string;
    companyName: string;
    websiteUrl: string;
  };
}

export function CampaignsList() {
  const [campaigns, setCampaigns] = React.useState<CampaignItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const fetchCampaigns = async () => {
    try {
      const res = await fetch("/api/gtm/campaigns");
      const data = await res.json();
      if (data.campaigns) {
        setCampaigns(data.campaigns);
      }
    } catch (e) {
      console.error("Failed to load campaigns:", e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  React.useEffect(() => {
    fetchCampaigns();
    const interval = setInterval(fetchCampaigns, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetchCampaigns();
  };

  const getStageBadge = (stage: string) => {
    switch (stage) {
      case "find_companies":
        return (
          <Badge variant="secondary" className="gap-1 text-xs">
            <Building2 className="size-3" /> Finding Companies
          </Badge>
        );
      case "find_contacts":
        return (
          <Badge variant="secondary" className="gap-1 text-xs">
            <Target className="size-3" /> Finding Contacts
          </Badge>
        );
      case "write_emails":
        return (
          <Badge variant="secondary" className="gap-1 text-xs">
            <Sparkles className="size-3" /> Drafting Emails
          </Badge>
        );
      case "awaiting_approval":
        return (
          <Badge
            variant="default"
            className="gap-1 text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium animate-pulse"
          >
            <AlertCircle className="size-3" /> Awaiting Review
          </Badge>
        );
      case "send_emails":
        return (
          <Badge variant="outline" className="gap-1 text-xs border-tertiary/30 bg-tertiary/10 text-tertiary">
            <Send className="size-3" /> Sending Emails
          </Badge>
        );
      case "done":
      case "done_for_now":
        return (
          <Badge variant="outline" className="gap-1 text-xs text-emerald-600 border-emerald-500/30">
            <CheckCircle2 className="size-3" /> Completed
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-xs capitalize">
            {stage.replace(/_/g, " ")}
          </Badge>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Outreach Campaigns
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Monitor pipeline execution, review AI-written email drafts, and trigger outreach.
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
            <RefreshCw className={cn("size-3.5", isRefreshing && "animate-spin")} />
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
          <CardContent className="p-10 text-center flex flex-col items-center justify-center space-y-3">
            <div className="size-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <Target className="size-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-medium text-foreground">No outreach campaigns yet</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Launch your first autonomous GTM campaign by entering your company website. Our agent
                will benchmark competitors, generate verified ICPs, and draft personalized cold emails.
              </p>
            </div>
            <Link
              href="/dashboard/campaigns/new"
              className={cn(buttonVariants({ size: "default" }), "gap-2 mt-2")}
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
                  campaign.status === "awaiting_approval";

                return (
                  <TableRow key={campaign.id} className="hover:bg-muted/40">
                    <TableCell className="font-medium">
                      <div>
                        <div className="text-sm text-foreground">
                          {researchRun?.companyName || "Company"} Outreach
                        </div>
                        <div className="text-xs text-muted-foreground truncate max-w-[220px]">
                          {researchRun?.websiteUrl}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getStageBadge(campaign.currentStage)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">
                        {campaign.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(campaign.createdAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
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
                            "gap-1 text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium"
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
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

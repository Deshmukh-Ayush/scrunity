"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  TrendingUp,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Mail,
  Calendar,
  CheckCircle2,
  HelpCircle,
  XCircle,
  MessageSquare,
  Building2,
} from "lucide-react";

export interface SegmentDigestCardProps {
  segmentId: string;
  segmentName?: string;
  className?: string;
}

export function SegmentDigestCard({
  segmentId,
  segmentName,
  className,
}: SegmentDigestCardProps) {
  const [digest, setDigest] = React.useState<any | null>(null);
  const [liveMetrics, setLiveMetrics] = React.useState<any | null>(null);
  const [segmentInfo, setSegmentInfo] = React.useState<any | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isGenerating, setIsGenerating] = React.useState(false);

  const fetchDigest = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/gtm/segments/${segmentId}/digest`);
      const data = await res.json();
      if (data.success) {
        setDigest(data.digest || null);
        setLiveMetrics(data.liveMetrics || null);
        if (data.segment) setSegmentInfo(data.segment);
      }
    } catch (err) {
      console.error("Failed to load segment digest:", err);
    } finally {
      setIsLoading(false);
    }
  }, [segmentId]);

  React.useEffect(() => {
    fetchDigest();
  }, [fetchDigest]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/gtm/segments/${segmentId}/digest`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate digest");
      }
      toast.success("Performance digest updated!");
      setDigest(data.digest);
      setLiveMetrics(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to generate digest");
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-8 w-24" />
          </div>
          <Skeleton className="h-4 w-72 mt-2" />
        </CardHeader>
        <CardContent className="p-4 pt-2 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-16 w-full rounded-md" />
            <Skeleton className="h-16 w-full rounded-md" />
          </div>
          <Skeleton className="h-20 w-full rounded-md" />
        </CardContent>
      </Card>
    );
  }

  // Choose either stored digest metrics or live computed fallback metrics
  const metrics = digest?.metrics || liveMetrics;
  const displayName = segmentName || segmentInfo?.name || "ICP Segment";

  if (!metrics && !digest) {
    return (
      <Card className={className}>
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-1.5">
              <TrendingUp className="size-4 text-primary" />
              Segment Performance Digest
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="gap-1.5 text-xs h-8"
            >
              <RefreshCw
                className={`size-3.5 ${isGenerating ? "animate-spin" : ""}`}
              />
              Generate Digest
            </Button>
          </div>
          <CardDescription className="text-xs">
            No digest data recorded yet for {displayName}.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const isSmallSample = metrics?.isSmallSample;

  return (
    <Card className={className}>
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start sm:items-center justify-between gap-2 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base flex items-center gap-1.5">
                <TrendingUp className="size-4 text-primary" />
                Performance & Learning Digest
              </CardTitle>
              {digest ? (
                <Badge variant="outline" className="text-[10px] py-0">
                  Stored Digest
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px] py-0">
                  Live Snapshot
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs mt-0.5">
              Target Segment: <strong className="text-foreground">{displayName}</strong>
              {digest?.generatedAt && (
                <span className="text-muted-foreground ml-2">
                  • Evaluated {new Date(digest.generatedAt).toLocaleDateString()}
                </span>
              )}
            </CardDescription>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="gap-1.5 text-xs h-8"
          >
            <RefreshCw
              className={`size-3.5 ${isGenerating ? "animate-spin" : ""}`}
            />
            {isGenerating ? "Computing..." : "Recompute Digest"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-3 space-y-4">
        {/* Small Sample Warning Alert */}
        {isSmallSample && (
          <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 py-2.5">
            <AlertCircle className="size-4 text-amber-600 dark:text-amber-400" />
            <AlertTitle className="text-xs font-semibold">
              Small Sample Size ({metrics.sentCount} emails sent)
            </AlertTitle>
            <AlertDescription className="text-xs text-amber-800/90 dark:text-amber-300/90">
              {metrics.sampleSizeWarning ||
                "Under 20 sent emails. Conversion and booking rates are early directional indicators only and not statistically significant yet."}
            </AlertDescription>
          </Alert>
        )}

        {/* Headline Numbers Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          <div className="border rounded-md p-2.5 bg-muted/20">
            <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
              <Mail className="size-3" /> Emails Sent
            </span>
            <div className="text-lg font-bold text-foreground mt-0.5">
              {metrics.sentCount}
            </div>
            <span className="text-[10px] text-muted-foreground">Total dispatched</span>
          </div>

          <div className="border rounded-md p-2.5 bg-muted/20">
            <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
              <MessageSquare className="size-3" /> Replies
            </span>
            <div className="text-lg font-bold text-foreground mt-0.5 flex items-baseline gap-1.5">
              <span>{metrics.repliedCount}</span>
              <span className="text-xs font-normal text-muted-foreground">
                ({metrics.replyRate}%)
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground">Overall reply rate</span>
          </div>

          <div className="border rounded-md p-2.5 bg-muted/20">
            <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-3" /> Interested
            </span>
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-baseline gap-1.5">
              <span>{metrics.replyBreakdown?.interested ?? 0}</span>
              <span className="text-xs font-normal text-muted-foreground">
                ({metrics.interestedReplyRate}%)
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground">Interested rate</span>
          </div>

          <div className="border rounded-md p-2.5 bg-muted/20">
            <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1 text-primary">
              <Calendar className="size-3" /> Booked Calls
            </span>
            <div className="text-lg font-bold text-primary mt-0.5 flex items-baseline gap-1.5">
              <span>{metrics.meetingsBookedCount}</span>
              <span className="text-xs font-normal text-muted-foreground">
                ({metrics.bookingRate}%)
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground">Meeting booking rate</span>
          </div>

          <div className="border rounded-md p-2.5 bg-muted/20 col-span-2 sm:col-span-1">
            <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
              <XCircle className="size-3" /> Bounces
            </span>
            <div className="text-lg font-bold text-foreground mt-0.5">
              {metrics.bouncedCount}
            </div>
            <span className="text-[10px] text-muted-foreground">Deliverability issues</span>
          </div>
        </div>

        {/* Reply Intent Breakdown */}
        <div className="border rounded-md p-3 bg-muted/10 space-y-1.5">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
            Classified Reply Breakdown
          </span>
          <div className="flex flex-wrap gap-2 pt-0.5">
            <Badge
              variant="outline"
              className="text-xs gap-1 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10"
            >
              Interested: {metrics.replyBreakdown?.interested ?? 0}
            </Badge>
            <Badge
              variant="outline"
              className="text-xs gap-1 border-blue-500/40 text-blue-700 dark:text-blue-300 bg-blue-500/10"
            >
              Questions: {metrics.replyBreakdown?.question ?? 0}
            </Badge>
            <Badge
              variant="outline"
              className="text-xs gap-1 text-muted-foreground bg-muted/30"
            >
              Auto-replies: {metrics.replyBreakdown?.autoReply ?? 0}
            </Badge>
            <Badge
              variant="outline"
              className="text-xs gap-1 border-rose-500/30 text-rose-700 dark:text-rose-300 bg-rose-500/10"
            >
              Not interested: {metrics.replyBreakdown?.notInterested ?? 0}
            </Badge>
            <Badge
              variant="outline"
              className="text-xs gap-1 text-muted-foreground"
            >
              Unclear: {metrics.replyBreakdown?.unclear ?? 0}
            </Badge>
          </div>
        </div>

        {/* Generated Summary Section */}
        {digest?.summary ? (
          <div className="border rounded-md p-3.5 bg-card space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Sparkles className="size-3.5 text-primary" />
              <span>GTM Learning Summary</span>
            </div>
            <div className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
              {digest.summary}
            </div>
          </div>
        ) : (
          <div className="border border-dashed rounded-md p-3 text-center">
            <p className="text-xs text-muted-foreground">
              Click &quot;Recompute Digest&quot; to synthesize an AI learning summary for this segment.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

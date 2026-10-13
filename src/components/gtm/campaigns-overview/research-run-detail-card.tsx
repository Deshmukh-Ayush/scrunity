import { Building2, Globe, Loader2, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AiSizeEstimate, MarketContextSummary } from "../market-context"
import type { ResearchRunDetail } from "./types"

/** Competitors and ICP segments of the selected research run, with per-segment launch. */
export function ResearchRunDetailCard({
  detail,
  startingSegmentId,
  onStartCampaign,
  onClose,
}: {
  detail: ResearchRunDetail
  startingSegmentId: string | null
  onStartCampaign: (segmentId: string) => void
  onClose: () => void
}) {
  const { researchRun, competitors, segments } = detail

  return (
    <Card className="mt-6 border-primary/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="size-5 text-primary" />
              {researchRun.companyName} Research Snapshot
            </CardTitle>
            <CardDescription className="mt-1">
              Website: {researchRun.websiteUrl} | Stage:{" "}
              <span className="font-semibold text-foreground">
                {researchRun.currentStage}
              </span>
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <MarketContextSummary run={researchRun} />
        {competitors?.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Benchmarked Competitors ({competitors.length})
            </h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {competitors.map((c) => (
                <div
                  key={c.id}
                  className="space-y-1 rounded-md border bg-muted/20 p-2.5 text-xs"
                >
                  <div className="flex items-center justify-between font-medium text-foreground">
                    <span>{c.name}</span>
                    <a
                      href={`https://${c.domain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground hover:text-primary"
                      aria-label={`Open ${c.domain}`}
                    >
                      <Globe className="size-3" />
                    </a>
                  </div>
                  <p className="line-clamp-2 text-muted-foreground">
                    {c.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {segments?.length > 0 && (
          <div>
            <h3 className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Verified ICP Segments ({segments.length})
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              {segments.map((seg) => (
                <div
                  key={seg.id}
                  className="space-y-2.5 rounded-lg border bg-card p-3.5 transition-all hover:border-foreground/30"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-medium text-foreground">
                        {seg.name}
                      </h4>
                      <AiSizeEstimate label={seg.estimatedSizeLabel} />
                    </div>
                    <Button
                      size="sm"
                      disabled={startingSegmentId === seg.id}
                      onClick={() => onStartCampaign(seg.id)}
                      className="h-7 gap-1.5 text-xs"
                    >
                      {startingSegmentId === seg.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Mail className="size-3" />
                      )}
                      Start Outreach
                    </Button>
                  </div>

                  <div className="space-y-1 text-xs text-muted-foreground">
                    <p>
                      <strong className="text-foreground">Pain Point:</strong>{" "}
                      {seg.painPoint}
                    </p>
                    {seg.criteria && seg.criteria.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {seg.criteria.map((cr, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className="py-0 text-[10px]"
                          >
                            {cr}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {seg.exampleCompanies &&
                      seg.exampleCompanies.length > 0 && (
                        <p className="pt-1 text-[11px] text-foreground/80">
                          <strong>Live Examples:</strong>{" "}
                          {seg.exampleCompanies.map((ex) => ex.name).join(", ")}
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
  )
}

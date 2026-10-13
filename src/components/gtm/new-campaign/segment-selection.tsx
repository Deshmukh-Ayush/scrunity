"use client"

import { ArrowRight, Check, Loader2, Mail } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { AiSizeEstimate, MarketContextSummary } from "../market-context"
import type { IcpSegment, ResearchRunDetails } from "./types"

function SegmentCard({
  segment,
  isSelected,
  onToggle,
}: {
  segment: IcpSegment
  isSelected: boolean
  onToggle: () => void
}) {
  return (
    <Card
      role="checkbox"
      aria-checked={isSelected}
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault()
          onToggle()
        }
      }}
      data-selected={isSelected || undefined}
      className={cn(
        "cursor-pointer border-2 border-border/70 transition-all hover:border-border",
        "data-[selected]:border-primary data-[selected]:bg-primary/5 data-[selected]:shadow-xs"
      )}
    >
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base text-foreground">
              {segment.name}
            </CardTitle>
            <AiSizeEstimate label={segment.estimatedSizeLabel} />
          </div>
          <div
            aria-hidden="true"
            className={cn(
              "flex size-5 items-center justify-center rounded border transition-colors",
              isSelected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-muted-foreground/40 bg-background"
            )}
          >
            {isSelected && <Check className="size-3.5 stroke-[3]" />}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-2">
        <div className="space-y-1 text-xs">
          <span className="font-semibold text-foreground">
            Acute Pain Point:
          </span>
          <p className="leading-relaxed text-muted-foreground">
            {segment.painPoint}
          </p>
        </div>

        {segment.criteria && segment.criteria.length > 0 && (
          <div className="space-y-1">
            <span className="text-[11px] font-semibold text-foreground">
              Qualification Criteria:
            </span>
            <div className="flex flex-wrap gap-1">
              {segment.criteria.map((c, i) => (
                <Badge
                  key={i}
                  variant="secondary"
                  className="py-0 text-[10px] font-normal"
                >
                  {c}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {segment.exampleCompanies && segment.exampleCompanies.length > 0 && (
          <div className="border-t border-border/40 pt-1 text-[11px] text-muted-foreground">
            <strong className="text-foreground">
              Discovered Live Examples:
            </strong>{" "}
            {segment.exampleCompanies.map((ex) => ex.name).join(", ")}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** Step 4: choose which ICP segments to launch as outreach campaigns. */
export function SegmentSelection({
  run,
  segments,
  selectedIds,
  onToggle,
  onToggleAll,
  isLaunching,
  onLaunch,
}: {
  run: ResearchRunDetails | null
  segments: IcpSegment[]
  selectedIds: Set<string>
  onToggle: (segmentId: string) => void
  onToggleAll: () => void
  isLaunching: boolean
  onLaunch: () => void
}) {
  const allSelected = selectedIds.size === segments.length

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Select ICP Segments to Pursue
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Autonomous research complete. Select which Ideal Customer Profile
            segments to launch as cold outreach campaigns.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onToggleAll}>
          {allSelected ? "Deselect All" : "Select All"}
        </Button>
      </div>

      {run && <MarketContextSummary run={run} />}

      <div className="grid gap-4 md:grid-cols-2">
        {segments.map((seg) => (
          <SegmentCard
            key={seg.id}
            segment={seg}
            isSelected={selectedIds.has(seg.id)}
            onToggle={() => onToggle(seg.id)}
          />
        ))}
      </div>

      <div className="flex items-center justify-between border-t pt-4">
        <p className="text-sm text-muted-foreground">
          {selectedIds.size} of {segments.length} segment(s) selected
        </p>
        <Button
          size="default"
          disabled={selectedIds.size === 0 || isLaunching}
          onClick={onLaunch}
          className="gap-2"
        >
          {isLaunching ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Launching Campaigns...
            </>
          ) : (
            <>
              <Mail className="size-4" />
              Launch Selected Campaigns ({selectedIds.size})
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

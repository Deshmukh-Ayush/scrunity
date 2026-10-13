"use client"

import { ArrowRight, Check, Mail } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { DemoSegment } from "./demo-data"

/** Onboarding step 4: pick which (demo) ICP segments to "launch". */
export function OnboardingSegments({
  segments,
  selectedIds,
  onToggle,
  onToggleAll,
  onLaunch,
}: {
  segments: DemoSegment[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
  onToggleAll: () => void
  onLaunch: () => void
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Select ICP Segments to Pursue
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Autonomous research complete. Select which Ideal Customer Profile
            segments to launch as cold outreach campaigns.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onToggleAll}
          className="self-start"
        >
          {selectedIds.size === segments.length ? "Deselect All" : "Select All"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {segments.map((seg) => {
          const isSelected = selectedIds.has(seg.id)
          return (
            <Card
              key={seg.id}
              role="checkbox"
              aria-checked={isSelected}
              tabIndex={0}
              onClick={() => onToggle(seg.id)}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault()
                  onToggle(seg.id)
                }
              }}
              className={cn(
                "cursor-pointer border-2 transition-all",
                isSelected
                  ? "border-primary bg-primary/5 shadow-xs"
                  : "border-border/70 hover:border-border"
              )}
            >
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base text-foreground">
                      {seg.name}
                    </CardTitle>
                    <span className="text-xs text-muted-foreground italic">
                      Est. Size: {seg.estimatedSizeLabel}
                    </span>
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
                    {seg.painPoint}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-foreground">
                    Qualification Criteria:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {seg.criteria.map((c, i) => (
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
                <div className="border-t border-border/40 pt-1 text-[11px] text-muted-foreground">
                  <strong className="text-foreground">
                    Discovered Live Examples:
                  </strong>{" "}
                  {seg.exampleCompanies.map((ex) => ex.name).join(", ")}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="flex items-center justify-between border-t pt-4">
        <p className="text-sm text-muted-foreground">
          {selectedIds.size} of {segments.length} segment(s) selected
        </p>
        <Button
          size="default"
          disabled={selectedIds.size === 0}
          onClick={onLaunch}
          className="gap-2"
        >
          <Mail className="size-4" />
          Launch Selected Campaigns ({selectedIds.size})
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}

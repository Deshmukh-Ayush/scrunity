"use client"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { formatMoneyAmount, formatTargetMarket } from "@/lib/geo/countries"
import { LaunchFooter, type LaunchDataSource } from "./launch-footer"
import { SegmentRow } from "./segment-row"
import type { IcpSegment, ResearchRunDetails } from "./types"

const count = (n: number, one: string, many: string) =>
  `${n} ${new Intl.PluralRules("en").select(n) === "one" ? one : many}`

/** Target market and the user's own figures, labelled as entered by them. */
function MarketLine({ run }: { run: ResearchRunDetails }) {
  const market = formatTargetMarket(run.targetCountryCode, run.targetRegion)
  const tam = formatMoneyAmount(run.ownTamAmount, run.ownTamCurrency)
  const arr = formatMoneyAmount(run.ownArrAmount, run.ownArrCurrency)
  const facts = [
    market && `Selling in ${market}`,
    tam && `Your TAM ${tam} (you entered)`,
    arr && `Your ARR ${arr} (you entered)`,
  ].filter(Boolean)
  if (facts.length === 0) return null
  return <p className="text-body text-fg-muted tabular-nums">{facts.join(" · ")}</p>
}

/**
 * Step 4: choose which customer segments become campaigns. A selectable list
 * of rows that expand, select all / deselect all, and a sticky footer with
 * the count and the one brand action. No segments: an empty state with the
 * way back to the description.
 */
export function SegmentSelection({
  run,
  segments,
  selectedIds,
  onToggle,
  onToggleAll,
  isLaunching,
  onLaunch,
  onEditDescription,
  dataSource = null,
}: {
  run: ResearchRunDetails | null
  segments: IcpSegment[]
  selectedIds: Set<string>
  onToggle: (segmentId: string) => void
  onToggleAll: () => void
  isLaunching: boolean
  onLaunch: () => void
  onEditDescription: () => void
  /** The organization's data source: the credit estimate, or why starting is blocked. */
  dataSource?: LaunchDataSource | null
}) {
  const selected = selectedIds.size
  const allSelected = segments.length > 0 && selected === segments.length

  if (segments.length === 0) {
    return (
      <div className="rounded-xl border border-transparent bg-surface shadow-surface">
        <EmptyState
          title="No customer segments yet"
          description="Research didn't find segments it could stand behind. Describe what you sell in more detail and run it again."
          actions={<Button onClick={onEditDescription}>Edit description</Button>}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-title text-fg-strong">Choose customer segments</h1>
        <p className="text-body text-fg-muted">
          Each segment you choose becomes its own campaign. Open a segment to
          see why it fits before you choose it.
        </p>
        {run && <MarketLine run={run} />}
      </div>

      <section aria-labelledby="segments-heading" className="rounded-xl border border-transparent bg-surface shadow-surface">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
          <h2 id="segments-heading" className="text-section text-fg-default tabular-nums">
            {count(segments.length, "segment", "segments")}
          </h2>
          <Button variant="ghost" size="sm" onClick={onToggleAll}>
            {allSelected ? "Deselect all" : "Select all"}
          </Button>
        </div>
        <ul aria-label="Customer segments" className="px-2">
          {segments.map((seg) => (
            <SegmentRow
              key={seg.id}
              segment={seg}
              selected={selectedIds.has(seg.id)}
              onToggle={() => onToggle(seg.id)}
            />
          ))}
        </ul>
      </section>

      <LaunchFooter selected={selected} isLaunching={isLaunching} onLaunch={onLaunch} dataSource={dataSource} />
    </div>
  )
}

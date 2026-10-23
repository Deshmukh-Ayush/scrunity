"use client"

import Link from "next/link"
import { Button, buttonVariants } from "@/components/ui/button"
import { DATA_SOURCE_COPY as COPY } from "@/lib/data-sources/copy"
import type { DataSourcesStatus } from "@/lib/data-sources/types"
import { cn } from "@/lib/utils"
import type { PublicImport } from "@/lib/contact-import/types"
import { SOURCE_COPY } from "./source-choice"

const count = (n: number, one: string, many: string) =>
  `${n} ${new Intl.PluralRules("en").select(n) === "one" ? one : many}`

/** What the segment step knows about the organization's data source (null while loading or unknown). */
export type LaunchDataSource = Pick<DataSourcesStatus, "access" | "estimate" | "imports"> & { needsReconnect: boolean }

/**
 * The sticky footer of the segment step: the count and the one brand action.
 * With a connected Apollo account it also states the worst-case Apollo credit
 * cost before anything starts. Without one, starting is blocked and the brand
 * action becomes "Connect Apollo" (same place, one primary action). With an
 * imported list it names the list instead and starts exactly one campaign.
 */
export function LaunchFooter({
  selected,
  isLaunching,
  onLaunch,
  dataSource,
  importList = null,
}: {
  selected: number
  isLaunching: boolean
  onLaunch: () => void
  dataSource: LaunchDataSource | null
  /** The imported list the campaign will use, when that source is chosen. */
  importList?: PublicImport | null
}) {
  const surface =
    "sticky bottom-4 z-10 flex flex-col gap-3 rounded-xl border border-transparent bg-surface p-3 shadow-floating sm:flex-row sm:items-center sm:justify-between sm:ps-4"

  if (importList) {
    const tooMany = selected > 1
    return (
      <div className={surface}>
        <div className="flex min-w-0 flex-col gap-0.5">
          <p id="segments-selected" aria-live="polite" className="text-body text-fg-default tabular-nums">
            {selected === 0 ? "Choose one segment to start." : tooMany ? SOURCE_COPY.oneSegmentOnly : "1 segment selected"}
          </p>
          <p id="segments-estimate" className="min-w-0 break-words text-body text-fg-muted tabular-nums">
            {SOURCE_COPY.importFooter(importList.fileName, importList.counts.imported)}
          </p>
        </div>
        <Button
          variant="brand"
          size="lg"
          onClick={onLaunch}
          loading={isLaunching}
          disabled={selected !== 1}
          aria-describedby="segments-selected segments-estimate"
          className="w-full shrink-0 sm:w-auto"
        >
          Start campaign
        </Button>
      </div>
    )
  }

  if (dataSource?.access === "not_connected") {
    return (
      <div className={surface}>
        <p id="segments-blocked" role="status" className="text-body text-fg-default">
          {dataSource.needsReconnect ? COPY.startBlockedReconnect : COPY.startBlocked}
        </p>
        <Link
          href="/dashboard/settings/data-sources"
          aria-describedby="segments-blocked"
          className={cn(buttonVariants({ variant: "brand", size: "lg" }), "w-full shrink-0 sm:w-auto")}
        >
          {dataSource.needsReconnect ? COPY.reconnectAction : COPY.connectAction}
        </Link>
      </div>
    )
  }

  const estimate =
    dataSource?.access === "customer" && selected > 0
      ? COPY.estimate(dataSource.estimate.maxCreditsPerCampaign, selected)
      : null

  return (
    <div className={surface}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p id="segments-selected" aria-live="polite" className="text-body text-fg-default tabular-nums">
          {selected === 0 ? "Choose at least one segment to start." : `${count(selected, "segment", "segments")} selected`}
        </p>
        {estimate && (
          <p id="segments-estimate" className="text-body text-fg-muted tabular-nums">
            {estimate} <span className="text-fg-muted">{COPY.estimateDetail}</span>
          </p>
        )}
      </div>
      <Button
        variant="brand"
        size="lg"
        onClick={onLaunch}
        loading={isLaunching}
        disabled={selected === 0}
        aria-describedby={estimate ? "segments-selected segments-estimate" : "segments-selected"}
        className="w-full shrink-0 sm:w-auto"
      >
        {selected === 0 ? "Start campaigns" : `Start ${count(selected, "campaign", "campaigns")}`}
      </Button>
    </div>
  )
}

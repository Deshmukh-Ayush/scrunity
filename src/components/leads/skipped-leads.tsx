"use client"

import * as React from "react"
import { ChevronRight } from "@/components/ui/icons"

/** One person the default view leaves out, with a neutral reason. */
export interface SkippedLead {
  id: string
  name: string
  title?: string | null
  companyName: string
  reason: string
}

const plural = new Intl.PluralRules("en")

/** "Reviewed 23 people · 12 verified · 4 from your list" (the list part only when there are some). */
export function leadSummaryText(reviewed: number, verified: number, fromList = 0): string {
  const people = plural.select(reviewed) === "one" ? "person" : "people"
  const parts = [`Reviewed ${reviewed.toLocaleString("en-US")} ${people}`, `${verified.toLocaleString("en-US")} verified`]
  if (fromList > 0) parts.push(`${fromList.toLocaleString("en-US")} from your list`)
  return parts.join(" · ")
}

/** The quiet summary line shown above lead lists. Verified and from-your-list are counted apart. */
export function LeadSummaryLine({
  reviewed,
  verified,
  fromList = 0,
  className,
}: {
  reviewed: number
  verified: number
  fromList?: number
  className?: string
}) {
  return (
    <p className={className ?? "text-xs text-muted-foreground"} data-slot="lead-summary">
      {leadSummaryText(reviewed, verified, fromList)}
    </p>
  )
}

/**
 * A collapsed, neutral list of skipped people (closed by default). Either pass
 * `leads`, or `load` to fetch them the first time the section is opened.
 */
export function SkippedLeads({
  count,
  leads,
  load,
}: {
  count: number
  leads?: SkippedLead[]
  load?: () => Promise<SkippedLead[]>
}) {
  const [fetched, setFetched] = React.useState<SkippedLead[] | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const loaded = leads ?? fetched

  if (count === 0) return null

  const onToggle = async (event: React.SyntheticEvent<HTMLDetailsElement>) => {
    if (!event.currentTarget.open || loaded || !load) return
    setIsLoading(true)
    try {
      setFetched(await load())
    } catch {
      setFetched([])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <details className="group rounded-md bg-card text-xs shadow-surface" onToggle={onToggle}>
      <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-2 text-muted-foreground select-none hover:text-foreground">
        <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" aria-hidden />
        Skipped ({count})
      </summary>
      <ul className="divide-y divide-border/60 border-t border-border/60">
        {isLoading && <li className="px-3 py-2 text-muted-foreground">Loading…</li>}
        {loaded?.map((lead) => (
          <li key={lead.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3 py-2">
            <span className="text-foreground">
              {lead.name}
              <span className="text-muted-foreground">
                {lead.title ? ` · ${lead.title}` : ""}
                {lead.companyName ? ` · ${lead.companyName}` : ""}
              </span>
            </span>
            <span className="text-muted-foreground">{lead.reason}</span>
          </li>
        ))}
      </ul>
    </details>
  )
}

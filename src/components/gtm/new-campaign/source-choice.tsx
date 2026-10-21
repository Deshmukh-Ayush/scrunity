"use client"

import Link from "next/link"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { count } from "@/lib/contact-import/copy"
import type { PublicImport } from "@/lib/contact-import/types"
import type { DataSourcesStatus } from "@/lib/data-sources/types"
import { cn } from "@/lib/utils"

/** Where a new campaign's people come from. */
export type CampaignSource = { kind: "search" } | { kind: "import"; importId: string }

export type SourceStatus = Pick<DataSourcesStatus, "access" | "imports">

export const SOURCE_COPY = {
  legend: "Where people come from",
  searchApollo: "Find with Apollo",
  searchPlatform: "Find new companies",
  searchApolloText: "Searches your Apollo account for companies and decision makers that fit each segment.",
  searchPlatformText: "Searches for companies and decision makers that fit each segment.",
  searchNeedsApollo: "Connect your Apollo account to search.",
  connectApollo: "Connect Apollo",
  importLabel: "Use an imported list",
  importText: "Writes to people from a CSV you imported. One list starts one campaign, so choose one segment.",
  importNeedsList: "Import a CSV of people first.",
  importAction: "Import a list",
  listLabel: "List",
  oneSegmentOnly: "An imported list starts one campaign. Choose one segment.",
  importFooter: (fileName: string, people: number) => `Uses ${count(people, "person", "people")} from ${fileName}. Nothing is searched or charged in Apollo.`,
} as const

/** The source chosen when the step opens: search when it can run, else the newest list. */
export function defaultSource(status: SourceStatus | null): CampaignSource {
  if (!status || status.access !== "not_connected" || status.imports.length === 0) return { kind: "search" }
  return { kind: "import", importId: status.imports[0].id }
}

export function chosenImport(status: SourceStatus | null, source: CampaignSource): PublicImport | null {
  return source.kind === "import" ? (status?.imports.find((l) => l.id === source.importId) ?? null) : null
}

function Choice({
  id,
  checked,
  disabled,
  onSelect,
  label,
  description,
  children,
}: {
  id: string
  checked: boolean
  disabled: boolean
  onSelect: () => void
  label: string
  description: string
  children?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border bg-surface p-3",
        checked && "border-fg-strong bg-canvas"
      )}
    >
      <label htmlFor={id} className={cn("flex items-start gap-2.5", disabled ? "cursor-default" : "cursor-pointer")}>
        <input
          id={id}
          type="radio"
          name="campaign-source"
          checked={checked}
          disabled={disabled}
          onChange={onSelect}
          aria-describedby={`${id}-text`}
          className="mt-0.5 size-4 shrink-0 accent-foreground disabled:opacity-60"
        />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className={cn("text-body text-fg-strong", checked && "font-semibold", disabled && "text-fg-muted")}>{label}</span>
          <span id={`${id}-text`} className="text-body text-fg-muted">
            {description}
          </span>
        </span>
      </label>
      {children && <div className="ps-6.5">{children}</div>}
    </div>
  )
}

/**
 * The segment step's source choice: search (Apollo, or platform data for
 * internal organizations) or an imported list. An option that can't run yet
 * is disabled and links to where it is set up; checked state is a strong
 * border plus weight, never brand.
 */
export function SourceChoice({
  status,
  source,
  onChange,
}: {
  status: SourceStatus
  source: CampaignSource
  onChange: (source: CampaignSource) => void
}) {
  const canSearch = status.access !== "not_connected"
  const lists = status.imports
  const platform = status.access === "platform"
  const selectedList = chosenImport(status, source)
  const linkClass = "text-body text-fg-strong underline underline-offset-2 hover:no-underline focus-ring rounded-sm"

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-section text-fg-default">{SOURCE_COPY.legend}</legend>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <Choice
          id="source-search"
          checked={source.kind === "search"}
          disabled={!canSearch}
          onSelect={() => onChange({ kind: "search" })}
          label={platform ? SOURCE_COPY.searchPlatform : SOURCE_COPY.searchApollo}
          description={!canSearch ? SOURCE_COPY.searchNeedsApollo : platform ? SOURCE_COPY.searchPlatformText : SOURCE_COPY.searchApolloText}
        >
          {!canSearch && (
            <Link href="/dashboard/settings/data-sources" className={linkClass}>
              {SOURCE_COPY.connectApollo}
            </Link>
          )}
        </Choice>
        <Choice
          id="source-import"
          checked={source.kind === "import"}
          disabled={lists.length === 0}
          onSelect={() => lists[0] && onChange({ kind: "import", importId: selectedList?.id ?? lists[0].id })}
          label={SOURCE_COPY.importLabel}
          description={lists.length === 0 ? SOURCE_COPY.importNeedsList : SOURCE_COPY.importText}
        >
          {lists.length === 0 ? (
            <Link href="/dashboard/settings/data-sources/import" className={linkClass}>
              {SOURCE_COPY.importAction}
            </Link>
          ) : (
            source.kind === "import" &&
            lists.length > 1 && (
              <Select
                items={lists.map((l) => ({ value: l.id, label: l.fileName }))}
                value={source.importId}
                onValueChange={(value) => value && onChange({ kind: "import", importId: value })}
              >
                <SelectTrigger aria-label={SOURCE_COPY.listLabel} className="w-full max-w-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {lists.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.fileName} ({count(l.counts.imported, "person", "people")})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )
          )}
        </Choice>
      </div>
    </fieldset>
  )
}

"use client"

import { ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Company, Contact } from "../types"

/** Letter avatar. No favicon service: that would send every prospect domain to a third party. */
export function CompanyAvatar({ name }: { name: string }) {
  const letter = name.trim().charAt(0).toUpperCase() || "?"
  return (
    <span
      aria-hidden
      className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-muted text-[11px] font-semibold text-muted-foreground"
    >
      {letter}
    </span>
  )
}

export function CompanyCell({ company }: { company: Company }) {
  return (
    <div className="flex min-w-[180px] items-center gap-2.5">
      <CompanyAvatar name={company.name} />
      <div className="min-w-0">
        <div className="truncate font-medium text-foreground">
          {company.name}
        </div>
        <div className="truncate text-[11px] text-muted-foreground">
          {company.domain}
        </div>
      </div>
    </div>
  )
}

export function locationText(company: Company) {
  return (
    [company.city, company.state, company.country].filter(Boolean).join(", ") ||
    company.location
  )
}

/** Soft, non-brand tints; the same industry always gets the same tint. */
const PILL_TINTS = [
  "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  "bg-amber-500/10 text-amber-800 dark:text-amber-300",
  "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  "bg-teal-500/10 text-teal-700 dark:text-teal-300",
  "bg-stone-500/10 text-stone-700 dark:text-stone-300",
]

function tintFor(label: string) {
  let hash = 0
  for (const ch of label) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return PILL_TINTS[hash % PILL_TINTS.length]
}

export function IndustryPill({
  industry,
}: {
  industry: string | null | undefined
}) {
  if (!industry) return <span className="text-muted-foreground">—</span>
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium whitespace-nowrap capitalize",
        tintFor(industry)
      )}
    >
      {industry}
    </span>
  )
}

export function WebsiteLink({ company }: { company: Company }) {
  const href = company.website || `https://${company.domain}`
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 whitespace-nowrap text-muted-foreground hover:text-foreground"
      aria-label={`Open ${company.domain} in a new tab`}
    >
      {company.domain}
      <ExternalLink className="size-3" />
    </a>
  )
}

export function StatusPill({
  tone,
  children,
}: {
  tone: "found" | "missing" | "neutral"
  children: React.ReactNode
}) {
  return (
    <span
      data-tone={tone}
      className={cn(
        "inline-flex h-5 items-center rounded-full border px-2 text-[11px] font-medium whitespace-nowrap",
        "data-[tone=found]:border-emerald-500/30 data-[tone=found]:bg-emerald-500/10 data-[tone=found]:text-emerald-700 dark:data-[tone=found]:text-emerald-300",
        "data-[tone=missing]:border-amber-500/30 data-[tone=missing]:bg-amber-500/10 data-[tone=missing]:text-amber-800 dark:data-[tone=missing]:text-amber-300",
        "data-[tone=neutral]:border-border data-[tone=neutral]:text-muted-foreground"
      )}
    >
      {children}
    </span>
  )
}

/** Name and title of each decision maker, or the honest not-found / not-run state. */
export function DecisionMakerCell({
  company,
  people,
  searching,
}: {
  company: Company
  people: Contact[]
  /** The decision-maker stage is running right now. */
  searching: boolean
}) {
  if (company.selectionStatus === "excluded")
    return <span className="text-muted-foreground">—</span>
  if (company.decisionMakerStatus === "no_decision_maker_found") {
    return <StatusPill tone="missing">Not found</StatusPill>
  }
  if (company.decisionMakerStatus === "no_verified_email") {
    return <StatusPill tone="neutral">No verified email</StatusPill>
  }
  if (people.length === 0) {
    return (
      <StatusPill tone="neutral">
        {searching ? "Searching…" : "Not searched"}
      </StatusPill>
    )
  }
  return (
    <div className="min-w-[180px] space-y-1.5">
      {people.map((person) => (
        <div key={person.id} className="flex items-start gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {person.linkedinUrl ? (
                <a
                  href={person.linkedinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate font-medium text-foreground hover:underline"
                >
                  {person.name}
                </a>
              ) : (
                <span className="truncate font-medium text-foreground">
                  {person.name}
                </span>
              )}
              <StatusPill tone="found">Found</StatusPill>
            </div>
            <div className="truncate text-[11px] text-muted-foreground">
              {person.title || "Title unknown"}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function EmailCell({
  company,
  people,
}: {
  company: Company
  people: Contact[]
}) {
  if (company.selectionStatus === "excluded" || people.length === 0) {
    return <span className="text-muted-foreground">—</span>
  }
  return <StatusPill tone="neutral">Pending</StatusPill>
}

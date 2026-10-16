"use client"

import { Search, X } from "@/components/ui/icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { CampaignOption } from "./types"

export const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "discovered", label: "Discovered" },
  { value: "lookup_incomplete", label: "Lookup Incomplete" },
  { value: "drafted", label: "Drafted" },
  { value: "approved", label: "Approved" },
  { value: "sent", label: "Sent" },
  { value: "bounced", label: "Bounced" },
  { value: "replied", label: "Replied" },
  { value: "meeting_booked", label: "Meeting Booked" },
  { value: "disqualified", label: "Disqualified" },
  { value: "failed", label: "Failed" },
]

/** Search box, campaign and status selects, and a reset when any filter is active. */
export function LeadsFilters({
  search,
  onSearchChange,
  campaignId,
  onCampaignChange,
  status,
  onStatusChange,
  campaigns,
  hasActiveFilters,
  onReset,
}: {
  search: string
  onSearchChange: (value: string) => void
  campaignId: string
  onCampaignChange: (value: string) => void
  status: string
  onStatusChange: (value: string) => void
  campaigns: CampaignOption[]
  hasActiveFilters: boolean
  onReset: () => void
}) {
  return (
    <div className="flex flex-col items-stretch gap-3 rounded-lg bg-card p-3 sm:flex-row sm:items-center shadow-surface">
      <div className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search by contact, company, title, or email..."
          aria-label="Search leads"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pr-7 pl-8"
        />
        {search && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onSearchChange("")}
            className="absolute top-1/2 right-1 h-6 w-6 -translate-y-1/2 p-0 text-muted-foreground hover:text-foreground"
            title="Clear search"
            aria-label="Clear search"
          >
            <X className="size-3" />
          </Button>
        )}
      </div>

      <div className="w-full sm:w-[220px]">
        <Select
          value={campaignId}
          onValueChange={(val) =>
            typeof val === "string" && onCampaignChange(val)
          }
        >
          <SelectTrigger
            className="w-full"
            aria-label="Campaign"
          >
            <SelectValue placeholder="All Campaigns" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Campaigns</SelectItem>
            {campaigns.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-full sm:w-[170px]">
        <Select
          value={status}
          onValueChange={(val) =>
            typeof val === "string" && onStatusChange(val)
          }
        >
          <SelectTrigger
            className="w-full"
            aria-label="Status"
          >
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="md"
          onClick={onReset}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X className="mr-1 size-3" />
          Reset
        </Button>
      )}
    </div>
  )
}

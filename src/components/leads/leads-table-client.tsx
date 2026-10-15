"use client"

import * as React from "react"
import { RefreshCw, Users } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { isValidPersonName } from "@/lib/gtm-contact-matcher"
import { checkLeadQualificationGates } from "@/lib/gtm-qualification-gates"
import { LeadReviewDialog } from "./lead-review-dialog"
import { LeadRow } from "./lead-row"
import { LeadsFilters } from "./leads-filters"
import { LeadsPagination } from "./leads-pagination"
import { LeadSummaryLine, SkippedLeads, type SkippedLead } from "./skipped-leads"
import { LEADS_PAGE_SIZE, type CampaignOption, type Lead, type LeadSummary } from "./types"

export type { Lead, CampaignOption }

export type LeadsTableClientProps = {
  initialLeads?: Lead[]
  initialTotal?: number
  initialCampaigns?: CampaignOption[]
  initialCampaignId?: string
  initialStatus?: string
  initialSearch?: string
  initialPage?: number
  initialSummary?: LeadSummary
}

/** Neutral reason for a lead in the Skipped section (never red, never a vendor name). */
function skippedReasonOf(lead: Lead): string {
  if (lead.verificationStatus !== "verified") return lead.skipReason || "Email not verified"
  return lead.status === "bounced" ? "Email bounced" : "Not selected for outreach"
}

/** Toast and refuse when a lead's name or qualification gates block outreach. */
function blockedReason(lead: Lead, verb: string) {
  if (!isValidPersonName(lead.name)) {
    return `Cannot ${verb}: "${lead.name}" is not a valid person name (pending re-discovery).`
  }
  const gate = checkLeadQualificationGates(lead)
  return gate.qualified ? null : `Cannot ${verb}: ${gate.reason}`
}

/**
 * Leads table: starts from the server-rendered page, then re-queries
 * GET /api/gtm/leads when filters or the page change, and after any action.
 */
export function LeadsTableClient({
  initialLeads = [],
  initialTotal = 0,
  initialCampaigns = [],
  initialCampaignId = "all",
  initialStatus = "all",
  initialSearch = "",
  initialPage = 1,
  initialSummary = { reviewed: 0, verified: 0 },
}: LeadsTableClientProps) {
  const [summary, setSummary] = React.useState(initialSummary)
  const [leads, setLeads] = React.useState(initialLeads)
  const [campaigns, setCampaigns] = React.useState(initialCampaigns)
  const [total, setTotal] = React.useState(initialTotal)
  const [totalPages, setTotalPages] = React.useState(
    Math.max(1, Math.ceil(initialTotal / LEADS_PAGE_SIZE))
  )
  const [isLoading, setIsLoading] = React.useState(false)

  const [search, setSearch] = React.useState(initialSearch)
  const [debouncedSearch, setDebouncedSearch] = React.useState(initialSearch)
  const [campaignId, setCampaignId] = React.useState(initialCampaignId)
  const [status, setStatus] = React.useState(initialStatus)
  const [page, setPage] = React.useState(initialPage)

  const [draftingLeadId, setDraftingLeadId] = React.useState<string | null>(
    null
  )
  const [reviewLead, setReviewLead] = React.useState<Lead | null>(null)

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 250)
    return () => clearTimeout(timer)
  }, [search])

  const fetchLeads = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("page", page.toString())
      params.set("pageSize", LEADS_PAGE_SIZE.toString())
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim())
      if (campaignId !== "all") params.set("campaignId", campaignId)
      if (status !== "all") params.set("status", status)
      const testOrg = new URLSearchParams(window.location.search).get(
        "test_org"
      )
      if (testOrg) params.set("test_org", testOrg)

      const res = await fetch(`/api/gtm/leads?${params.toString()}`)
      if (!res.ok) throw new Error(`Failed to load leads: ${res.statusText}`)
      const data = await res.json()
      if (data.success) {
        setLeads(data.leads || [])
        setTotal(data.total || 0)
        setTotalPages(data.totalPages || 1)
        if (data.campaigns) setCampaigns(data.campaigns)
        if (data.summary) setSummary(data.summary)
      }
    } catch (err) {
      console.error("[LeadsTableClient] Error fetching leads:", err)
    } finally {
      setIsLoading(false)
    }
  }, [page, debouncedSearch, campaignId, status])

  // The server rendered the first page; only fetch on mount if it came back empty.
  const isInitialMount = React.useRef(true)
  React.useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      if (initialLeads.length === 0 && initialTotal === 0) fetchLeads()
      return
    }
    fetchLeads()
  }, [fetchLeads, initialLeads.length, initialTotal])

  const handleDraftEmail = async (lead: Lead) => {
    const blocked = blockedReason(lead, "generate draft")
    if (blocked) {
      toast.error(blocked)
      return
    }
    setDraftingLeadId(lead.id)
    try {
      const res = await fetch(`/api/gtm/leads/${lead.id}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const data = await res.json()
      if (!res.ok)
        throw new Error(data.error || "Failed to generate email draft")
      toast.success(`Draft generated for ${lead.name}`)
      await fetchLeads()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to generate email draft"
      )
    } finally {
      setDraftingLeadId(null)
    }
  }

  const handleOpenReview = (lead: Lead) => {
    const blocked = blockedReason(lead, "review draft")
    if (blocked) {
      toast.error(blocked)
      return
    }
    setReviewLead(lead)
  }

  const handleClearFilters = () => {
    setSearch("")
    setDebouncedSearch("")
    setCampaignId("all")
    setStatus("all")
    setPage(1)
  }

  const loadSkipped = async (): Promise<SkippedLead[]> => {
    const params = new URLSearchParams({ view: "skipped", pageSize: "100" })
    if (campaignId !== "all") params.set("campaignId", campaignId)
    const testOrg = new URLSearchParams(window.location.search).get("test_org")
    if (testOrg) params.set("test_org", testOrg)
    const res = await fetch(`/api/gtm/leads?${params.toString()}`)
    const data = await res.json()
    return ((data.leads || []) as Lead[]).map((lead) => ({
      id: lead.id,
      name: lead.name,
      title: lead.title,
      companyName: lead.companyName,
      reason: skippedReasonOf(lead),
    }))
  }

  const hasActiveFilters =
    search !== "" || campaignId !== "all" || status !== "all"

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Leads
            </h1>
            <Badge
              variant="neutral"
              className="px-2 py-0.5">
              {total} {total === 1 ? "lead" : "leads"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Leads with a verified email across your campaigns.
          </p>
          <LeadSummaryLine
            reviewed={summary.reviewed}
            verified={summary.verified}
            className="mt-0.5 text-xs text-muted-foreground"
          />
        </div>
        <Button
          variant="outline"
          size="md"
          onClick={() => fetchLeads()}
          disabled={isLoading}
          className="gap-1.5"
        >
          <RefreshCw className={cn("size-3.5", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <LeadsFilters
        search={search}
        onSearchChange={setSearch}
        campaignId={campaignId}
        onCampaignChange={(val) => {
          setCampaignId(val)
          setPage(1)
        }}
        status={status}
        onStatusChange={(val) => {
          setStatus(val)
          setPage(1)
        }}
        campaigns={campaigns}
        hasActiveFilters={hasActiveFilters}
        onReset={handleClearFilters}
      />

      <div className="overflow-hidden rounded-md border border-border/60 bg-card">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="w-[180px] text-xs font-semibold">
                Contact Name
              </TableHead>
              <TableHead className="w-[160px] text-xs font-semibold">
                Title
              </TableHead>
              <TableHead className="w-[200px] text-xs font-semibold">
                Company
              </TableHead>
              <TableHead className="w-[180px] text-xs font-semibold">
                Campaign
              </TableHead>
              <TableHead className="w-[120px] text-xs font-semibold">
                Status
              </TableHead>
              <TableHead className="text-xs font-semibold">Email</TableHead>
              <TableHead className="w-[150px] pr-4 text-right text-xs font-semibold">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-32 text-center text-xs text-muted-foreground"
                >
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw className="size-4 animate-spin text-muted-foreground" />
                    <span>Loading leads...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : leads.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-40 text-center text-xs text-muted-foreground"
                >
                  <div className="flex flex-col items-center justify-center gap-1.5 py-6">
                    <Users className="mb-1 size-8 text-muted-foreground/40" />
                    <p className="font-medium text-foreground">
                      No leads found
                    </p>
                    <p className="max-w-sm text-muted-foreground">
                      {hasActiveFilters
                        ? "No contacts match your current filter combination. Try clearing some filters."
                        : "No leads discovered yet for this organization."}
                    </p>
                    {hasActiveFilters && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleClearFilters}
                        className="mt-2"
                      >
                        Clear filters
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              leads.map((lead) => (
                <LeadRow
                  key={lead.id}
                  lead={lead}
                  isDrafting={draftingLeadId === lead.id}
                  onDraft={handleDraftEmail}
                  onReview={handleOpenReview}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {total > 0 && (
        <LeadsPagination
          page={page}
          totalPages={totalPages}
          total={total}
          disabled={isLoading}
          onPageChange={setPage}
        />
      )}

      <SkippedLeads
        key={campaignId}
        count={Math.max(0, summary.reviewed - summary.verified)}
        load={loadSkipped}
      />

      <LeadReviewDialog
        lead={reviewLead}
        onClose={() => setReviewLead(null)}
        onChanged={fetchLeads}
      />
    </div>
  )
}
